"use node";

import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internalAction, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const RUN_REQUEST = {
  arxiv_id: "2009.05713",
  model: "xlmr.large",
  split_seed: 1,
  n_train: 500,
  max_rows: 500,
  experiment_mode: "paper_faithful",
  experiment_type: "A",
  total_data: 500,
  valid_size: 0.1,
  data_seed: 1,
  model_seed: 4,
};

const actionArgs = { jobId: v.id("jobs") };

export const extractPaper = internalAction({
  args: actionArgs,
  handler: async (ctx, args) => {
    await startStage(ctx, args.jobId, "paper_extract");
    try {
      const detail = await getJobDetail(ctx, args.jobId);
      const job = detail.job;
      await event(ctx, args.jobId, "paper_extract", "info", "Starting Cursor paper extraction.");
      const extraction = await extractManifestWithCursor(ctx, args.jobId, job);
      await ctx.runMutation(makeFunctionReference<"mutation">("jobs:saveExtractedManifest"), {
        jobId: args.jobId,
        cursorAgentId: extraction.cursorAgentId,
        cursorRunId: extraction.cursorRunId,
        manifest: extraction.manifest,
      });
      await completeStage(ctx, args.jobId, "paper_extract", {
        title: extraction.manifest.title,
        supported: extraction.manifest.supported,
        supportKey: extraction.manifest.supportKey,
      });

      if (!extraction.manifest.supported) {
        await ctx.runMutation(makeFunctionReference<"mutation">("jobs:blockUnsupported"), {
          jobId: args.jobId,
          reason: "Extraction succeeded, but live reproduction is not mapped for this paper yet.",
        });
        return;
      }

      await event(
        ctx,
        args.jobId,
        "paper_extract",
        "info",
        "Extraction succeeded; scheduling Adaption and baseline in parallel."
      );
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"action">("jobActions:runAdaption"),
        { jobId: args.jobId }
      );
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"action">("jobActions:runBaseline"),
        { jobId: args.jobId }
      );
    } catch (error) {
      await failStage(ctx, args.jobId, "paper_extract", error);
    }
  },
});

export const runBaseline = internalAction({
  args: actionArgs,
  handler: async (ctx, args) => {
    await startStage(ctx, args.jobId, "baseline_run");
    try {
      await event(ctx, args.jobId, "baseline_run", "info", "Starting Modal raw baseline.");
      const run = await callModal("/paper-baseline", RUN_REQUEST, 900_000);
      await ctx.runMutation(makeFunctionReference<"mutation">("jobs:saveRuns"), {
        jobId: args.jobId,
        runnerConfig: RUN_REQUEST,
        runs: [{ ...run, jobId: args.jobId }],
      });
      await completeStage(ctx, args.jobId, "baseline_run", {
        metricValue: run.metricValue,
        trainingSource: run.trainingSource,
      });
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"action">("jobActions:finalizeJob"),
        { jobId: args.jobId }
      );
    } catch (error) {
      await failStage(ctx, args.jobId, "baseline_run", error);
    }
  },
});

export const runAdaption = internalAction({
  args: actionArgs,
  handler: async (ctx, args) => {
    await startStage(ctx, args.jobId, "adaption_run");
    try {
      await event(ctx, args.jobId, "adaption_run", "info", "Uploading training rows to Adaption.");
      const result = await callModal("/paper-adaption", RUN_REQUEST, 900_000);
      const adapted = result.adapted;
      const adaption = result.adaption;
      if (!adapted?.datasetId) {
        throw new Error("Modal paper-adaption did not return an Adaption dataset id");
      }
      await ctx.runMutation(makeFunctionReference<"mutation">("jobs:saveAdaptedDataset"), {
        jobId: args.jobId,
        datasetId: adapted.datasetId,
        status: adapted.status ?? "succeeded",
        rowCount: adapted.rowCount ?? null,
        rowsReturned: adapted.rowsReturned ?? 0,
        rowsPassedValidation: adapted.rowsPassedValidation ?? 0,
        drops: adapted.drops ?? {},
        audit: adapted.audit,
        adaption,
        previewRows: adapted.rows ?? [],
      });
      await completeStage(ctx, args.jobId, "adaption_run", {
        datasetId: adapted.datasetId,
        rowsPassedValidation: adapted.rowsPassedValidation ?? 0,
        drops: adapted.drops ?? {},
      });
      await event(
        ctx,
        args.jobId,
        "adaption_run",
        "info",
        "Adaption completed; scheduling adapted-only Modal run."
      );
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"action">("jobActions:runAdapted"),
        { jobId: args.jobId }
      );
    } catch (error) {
      await failStage(ctx, args.jobId, "adaption_run", error);
    }
  },
});

export const runAdapted = internalAction({
  args: actionArgs,
  handler: async (ctx, args) => {
    await startStage(ctx, args.jobId, "adapted_run");
    try {
      const detail = await getJobDetail(ctx, args.jobId);
      const datasetId = detail.adaptedDataset?.datasetId;
      if (!datasetId) {
        throw new Error("No adapted dataset is available for the adapted run");
      }
      await event(ctx, args.jobId, "adapted_run", "info", "Starting Modal adapted-only run.");
      const result = await callModal(
        "/paper-adapted-run",
        { ...RUN_REQUEST, adaption_dataset_id: datasetId },
        900_000
      );
      const runs = Array.isArray(result.runs) ? result.runs : [result];
      await ctx.runMutation(makeFunctionReference<"mutation">("jobs:saveRuns"), {
        jobId: args.jobId,
        runnerConfig: RUN_REQUEST,
        runs: runs.map((run: Record<string, unknown>) => ({
          ...run,
          jobId: args.jobId,
        })),
      });
      await completeStage(ctx, args.jobId, "adapted_run", {
        datasetId,
        runs: runs.map((run: { trainingSource?: string; metricValue?: number }) => ({
          trainingSource: run.trainingSource,
          metricValue: run.metricValue,
        })),
      });
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"action">("jobActions:finalizeJob"),
        { jobId: args.jobId }
      );
    } catch (error) {
      await failStage(ctx, args.jobId, "adapted_run", error);
    }
  },
});

export const finalizeJob = internalAction({
  args: actionArgs,
  handler: async (ctx, args) => {
    await ctx.runMutation(makeFunctionReference<"mutation">("jobs:maybeFinalize"), {
      jobId: args.jobId,
    });
  },
});

async function extractManifestWithCursor(
  ctx: ActionCtx,
  jobId: Id<"jobs">,
  job: {
    arxivId: string;
    absUrl: string;
    pdfUrl: string;
  }
) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY is not configured in Convex env");
  }
  const repoUrl =
    process.env.CURSOR_CLOUD_REPO_URL ?? "https://github.com/ilhamfp/AdaptArxiv.git";
  const startingRef = process.env.CURSOR_CLOUD_STARTING_REF ?? "main";
  const model = process.env.CURSOR_AGENT_MODEL ?? "composer-2";

  const created = await cursorRequest<{
    agent: { id: string };
    run: CursorRun;
  }>(apiKey, "POST", "/v1/agents", {
    prompt: { text: paperExtractionPrompt(job) },
    model: { id: model },
    name: `AdaptArxiv ${job.arxivId}`,
    repos: [{ url: repoUrl, startingRef }],
    skipReviewerRequest: true,
  });

  await event(ctx, jobId, "paper_extract", "info", "Cursor cloud agent created.");
  let run = created.run;
  let lastStatus = run.status;
  await event(ctx, jobId, "paper_extract", "info", `Cursor run ${lastStatus.toLowerCase()}.`);

  for (let attempt = 0; attempt < 180 && !isTerminalRun(run.status); attempt += 1) {
    await delay(4000);
    run = await cursorRequest<CursorRun>(
      apiKey,
      "GET",
      `/v1/agents/${encodeURIComponent(created.agent.id)}/runs/${encodeURIComponent(
        run.id
      )}`
    );
    if (run.status !== lastStatus) {
      lastStatus = run.status;
      await event(
        ctx,
        jobId,
        "paper_extract",
        "info",
        `Cursor run ${lastStatus.toLowerCase()}.`
      );
    }
  }

  if (run.status !== "FINISHED") {
    throw new Error(`Cursor run did not finish successfully: ${run.status}`);
  }

  return {
    cursorAgentId: created.agent.id,
    cursorRunId: run.id,
    manifest: parseManifest(run.result, job),
  };
}

type CursorRun = {
  id: string;
  status: "CREATING" | "RUNNING" | "FINISHED" | "ERROR" | "CANCELLED" | "EXPIRED";
  result?: string;
};

async function cursorRequest<T>(
  apiKey: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const baseUrl = process.env.CURSOR_BACKEND_URL ?? "https://api.cursor.com";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "x-cursor-client-type": "sdk",
      "x-cursor-client-version": "adaptarxiv-demo",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Cursor API ${method} ${path} failed: ${response.status} ${await response.text()}`
    );
  }
  return (await response.json()) as T;
}

function isTerminalRun(status: CursorRun["status"]) {
  return ["FINISHED", "ERROR", "CANCELLED", "EXPIRED"].includes(status);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function paperExtractionPrompt(job: { arxivId: string; absUrl: string; pdfUrl: string }) {
  return `Read and study this arXiv paper for AdaptArxiv: ${job.absUrl}

Return only one JSON object, with no Markdown fences and no commentary, matching:
{
  "arxivId": "${job.arxivId}",
  "absUrl": "${job.absUrl}",
  "pdfUrl": "${job.pdfUrl}",
  "title": "paper title",
  "authors": ["author"],
  "abstract": "short abstract",
  "datasetCandidates": [{"name":"dataset name","url":"https://...","description":"how it is used"}],
  "technique": {"name":"method name","summary":"what is trained/evaluated","model":"model id/name","task":"task"},
  "reportedBaseline": {"metricName":"f1","metricValue":0.79,"notes":"what this number means"},
  "supportKey": "prosa_xlmr_paper_faithful or unsupported",
  "supported": true,
  "confidence": 0.0,
  "evidenceSnippets": ["short source-grounded evidence"]
}

For arXiv:2009.05713, identify the Indonesian sentiment/PROSA/XLM-R setup. For any uncertainty, keep confidence below 0.7.`;
}

function parseManifest(
  text: string | undefined,
  job: { arxivId: string; absUrl: string; pdfUrl: string }
) {
  const raw = text ?? "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Cursor did not return a JSON paper manifest");
  }
  const payload = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  const support = job.arxivId === "2009.05713";
  return {
    arxivId: job.arxivId,
    absUrl: job.absUrl,
    pdfUrl: job.pdfUrl,
    title: stringValue(payload.title, `arXiv:${job.arxivId}`),
    authors: stringArray(payload.authors),
    abstract: optionalString(payload.abstract),
    datasetCandidates: arrayValue(payload.datasetCandidates).map((candidate) => ({
      name: optionalString(candidate.name),
      url: optionalUrl(candidate.url),
      description: optionalString(candidate.description),
    })),
    technique: {
      name: optionalString(recordValue(payload.technique).name),
      summary: stringValue(recordValue(payload.technique).summary, "Technique not extracted"),
      model: optionalString(recordValue(payload.technique).model),
      task: optionalString(recordValue(payload.technique).task),
    },
    reportedBaseline: {
      metricName: stringValue(recordValue(payload.reportedBaseline).metricName, "f1"),
      metricValue: optionalNumber(recordValue(payload.reportedBaseline).metricValue),
      notes: optionalString(recordValue(payload.reportedBaseline).notes),
    },
    supportKey: support ? "prosa_xlmr_paper_faithful" : "unsupported",
    supported: support,
    confidence: clampNumber(payload.confidence, 0, 1, support ? 0.8 : 0.5),
    evidenceSnippets: stringArray(payload.evidenceSnippets),
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayValue(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object").map(recordValue)
    : [];
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      )
    : [];
}

function optionalUrl(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

async function callModal(path: string, payload: unknown, timeoutMs: number) {
  const baseUrl = process.env.MODAL_RUNNER_URL;
  if (!baseUrl) {
    throw new Error("MODAL_RUNNER_URL is not configured in Convex env");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Modal ${path} failed: ${response.status} ${await response.text()}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getJobDetail(ctx: ActionCtx, jobId: Id<"jobs">) {
  const detail = await ctx.runQuery(makeFunctionReference<"query">("jobs:getJobDetail"), {
    jobId,
  });
  if (!detail) {
    throw new Error("Job not found");
  }
  return detail as {
    job: {
      arxivId: string;
      absUrl: string;
      pdfUrl: string;
    };
    adaptedDataset?: { datasetId?: string } | null;
  };
}

async function startStage(ctx: ActionCtx, jobId: Id<"jobs">, stageKey: string) {
  await ctx.runMutation(makeFunctionReference<"mutation">("jobs:startStage"), {
    jobId,
    stageKey,
  });
}

async function completeStage(
  ctx: ActionCtx,
  jobId: Id<"jobs">,
  stageKey: string,
  output?: unknown
) {
  await ctx.runMutation(makeFunctionReference<"mutation">("jobs:completeStage"), {
    jobId,
    stageKey,
    output,
  });
}

async function failStage(
  ctx: ActionCtx,
  jobId: Id<"jobs">,
  stageKey: string,
  error: unknown
) {
  const message = error instanceof Error ? error.message : String(error);
  await ctx.runMutation(makeFunctionReference<"mutation">("jobs:failStage"), {
    jobId,
    stageKey,
    error: message,
    retryable: true,
  });
}

async function event(
  ctx: ActionCtx,
  jobId: Id<"jobs">,
  stageKey: string,
  level: "info" | "warn" | "error",
  message: string,
  payload?: unknown
) {
  await ctx.runMutation(makeFunctionReference<"mutation">("jobs:addJobEvent"), {
    jobId,
    stageKey,
    level,
    message,
    payload,
  });
}

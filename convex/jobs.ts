import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const STAGE_KEYS = [
  "paper_extract",
  "adaption_run",
  "baseline_run",
  "adapted_run",
  "finalize",
] as const;

const stageKey = v.union(
  v.literal("paper_extract"),
  v.literal("adaption_run"),
  v.literal("baseline_run"),
  v.literal("adapted_run"),
  v.literal("finalize")
);

const eventLevel = v.union(v.literal("info"), v.literal("warn"), v.literal("error"));

const createJobArgs = {
  adminSecret: v.optional(v.string()),
  arxivUrl: v.string(),
  autoStart: v.optional(v.boolean()),
};

const extractedManifest = v.object({
  arxivId: v.string(),
  absUrl: v.string(),
  pdfUrl: v.string(),
  title: v.string(),
  authors: v.array(v.string()),
  abstract: v.optional(v.string()),
  datasetCandidates: v.array(
    v.object({
      name: v.optional(v.string()),
      url: v.optional(v.string()),
      description: v.optional(v.string()),
    })
  ),
  technique: v.object({
    name: v.optional(v.string()),
    summary: v.string(),
    model: v.optional(v.string()),
    task: v.optional(v.string()),
  }),
  reportedBaseline: v.object({
    metricName: v.string(),
    metricValue: v.optional(v.number()),
    notes: v.optional(v.string()),
  }),
  supportKey: v.string(),
  supported: v.boolean(),
  confidence: v.number(),
  evidenceSnippets: v.array(v.string()),
});

type StageKey = (typeof STAGE_KEYS)[number];

export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").withIndex("by_created").order("desc").take(30);
  },
});

export const getJobDetail = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    const [stages, events, runs, adaptedDatasets] = await Promise.all([
      ctx.db
        .query("jobStages")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
        .collect(),
      ctx.db
        .query("jobEvents")
        .withIndex("by_job_created", (q) => q.eq("jobId", args.jobId))
        .order("desc")
        .take(80),
      ctx.db
        .query("runs")
        .withIndex("by_job_created", (q) => q.eq("jobId", args.jobId))
        .order("desc")
        .take(20),
      ctx.db
        .query("adaptedDatasets")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
        .order("desc")
        .take(1),
    ]);

    return {
      job,
      stages: orderStages(stages),
      events: events.reverse(),
      runs,
      adaptedDataset: adaptedDatasets[0] ?? null,
    };
  },
});

export const createJob = mutation({
  args: createJobArgs,
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const normalized = normalizeArxivUrl(args.arxivUrl);
    const support = paperSupportForArxivId(normalized.arxivId);
    const now = Date.now();

    const jobId = await ctx.db.insert("jobs", {
      arxivId: normalized.arxivId,
      arxivUrl: normalized.absUrl,
      absUrl: normalized.absUrl,
      pdfUrl: normalized.pdfUrl,
      status: "queued",
      currentStage: "paper_extract",
      supportKey: support.supportKey,
      supported: support.supported,
      createdAt: now,
      updatedAt: now,
    });

    for (const key of STAGE_KEYS) {
      await ctx.db.insert("jobStages", {
        jobId,
        stageKey: key,
        status: "pending",
        attempt: 0,
        updatedAt: now,
      });
    }

    await addEvent(ctx, {
      jobId,
      stageKey: "paper_extract",
      level: "info",
      message: `Created job for arXiv:${normalized.arxivId}`,
    });

    if (args.autoStart ?? true) {
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"action">("jobActions:extractPaper"),
        { jobId }
      );
    }

    return { jobId };
  },
});

export const retryJobStage = mutation({
  args: {
    adminSecret: v.optional(v.string()),
    jobId: v.id("jobs"),
    stageKey,
  },
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const job = await requireJob(ctx, args.jobId);
    const resetStages = getRetryStageReset(args.stageKey);
    const now = Date.now();

    for (const key of resetStages) {
      const stage = await findStage(ctx, args.jobId, key);
      if (stage) {
        await ctx.db.patch(stage._id, {
          status: "pending",
          error: undefined,
          retryable: undefined,
          output: undefined,
          startedAt: undefined,
          completedAt: undefined,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(job._id, {
      status: "queued",
      currentStage: args.stageKey,
      latestError: undefined,
      updatedAt: now,
    });
    await addEvent(ctx, {
      jobId: args.jobId,
      stageKey: args.stageKey,
      level: "info",
      message: `Retrying ${args.stageKey.replaceAll("_", " ")}`,
    });
    await scheduleStage(ctx, args.jobId, args.stageKey);
    return { ok: true };
  },
});

export const startStage = internalMutation({
  args: { jobId: v.id("jobs"), stageKey },
  handler: async (ctx, args) => {
    const stage = await requireStage(ctx, args.jobId, args.stageKey);
    const now = Date.now();
    await ctx.db.patch(stage._id, {
      status: "running",
      attempt: stage.attempt + 1,
      startedAt: now,
      completedAt: undefined,
      error: undefined,
      retryable: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(args.jobId, {
      status: "running",
      currentStage: args.stageKey,
      latestError: undefined,
      updatedAt: now,
    });
  },
});

export const completeStage = internalMutation({
  args: {
    jobId: v.id("jobs"),
    stageKey,
    output: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const stage = await requireStage(ctx, args.jobId, args.stageKey);
    const now = Date.now();
    await ctx.db.patch(stage._id, {
      status: "succeeded",
      output: args.output,
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.jobId, {
      latestError: undefined,
      updatedAt: now,
    });
  },
});

export const failStage = internalMutation({
  args: {
    jobId: v.id("jobs"),
    stageKey,
    error: v.string(),
    retryable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const stage = await requireStage(ctx, args.jobId, args.stageKey);
    const now = Date.now();
    await ctx.db.patch(stage._id, {
      status: "failed",
      error: args.error,
      retryable: args.retryable ?? true,
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.jobId, {
      status: "failed",
      currentStage: args.stageKey,
      latestError: args.error,
      updatedAt: now,
    });
    await addEvent(ctx, {
      jobId: args.jobId,
      stageKey: args.stageKey,
      level: "error",
      message: args.error,
    });
  },
});

export const saveExtractedManifest = internalMutation({
  args: {
    jobId: v.id("jobs"),
    cursorAgentId: v.optional(v.string()),
    cursorRunId: v.optional(v.string()),
    manifest: extractedManifest,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const support = paperSupportForArxivId(args.manifest.arxivId);
    await ctx.db.patch(args.jobId, {
      title: args.manifest.title,
      authors: args.manifest.authors,
      manifest: {
        ...args.manifest,
        supportKey: support.supportKey,
        supported: support.supported,
      },
      supportKey: support.supportKey,
      supported: support.supported,
      cursorAgentId: args.cursorAgentId,
      cursorRunId: args.cursorRunId,
      updatedAt: now,
    });
  },
});

export const blockUnsupported = internalMutation({
  args: { jobId: v.id("jobs"), reason: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "blocked",
      currentStage: "paper_extract",
      latestError: args.reason,
      updatedAt: now,
    });
    for (const key of ["adaption_run", "baseline_run", "adapted_run", "finalize"] as const) {
      const stage = await findStage(ctx, args.jobId, key);
      if (stage) {
        await ctx.db.patch(stage._id, {
          status: "blocked",
          error: args.reason,
          retryable: false,
          completedAt: now,
          updatedAt: now,
        });
      }
    }
    await addEvent(ctx, {
      jobId: args.jobId,
      stageKey: "paper_extract",
      level: "warn",
      message: args.reason,
    });
  },
});

export const saveRuns = internalMutation({
  args: {
    jobId: v.id("jobs"),
    runnerConfig: v.any(),
    runs: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const paperId = await ensurePaper(ctx, args.jobId);
    const now = Date.now();
    for (const run of args.runs) {
      await ctx.db.insert("runs", {
        paperId,
        jobId: args.jobId,
        runnerConfig: args.runnerConfig,
        trainingSource: run.trainingSource,
        metricName: run.metricName,
        metricValue: run.metricValue,
        provenance: run.provenance,
        testSetHash: run.testSetHash,
        durationMs: run.durationMs,
        modalCallId: run.modalCallId,
        validation: run.validation,
        adaption: run.adaption,
        audit: run.audit,
        experiment: run.experiment,
        createdAt: now,
      });
    }
  },
});

export const saveAdaptedDataset = internalMutation({
  args: {
    jobId: v.id("jobs"),
    datasetId: v.string(),
    status: v.string(),
    rowCount: v.optional(v.union(v.number(), v.null())),
    rowsReturned: v.number(),
    rowsPassedValidation: v.number(),
    drops: v.record(v.string(), v.number()),
    audit: v.optional(v.any()),
    adaption: v.optional(v.any()),
    previewRows: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("adaptedDatasets")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();
    const now = Date.now();
    const record = {
      datasetId: args.datasetId,
      status: args.status,
      rowCount: args.rowCount,
      rowsReturned: args.rowsReturned,
      rowsPassedValidation: args.rowsPassedValidation,
      drops: args.drops,
      audit: args.audit,
      adaption: args.adaption,
      previewRows: args.previewRows,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, record);
    } else {
      await ctx.db.insert("adaptedDatasets", {
        jobId: args.jobId,
        ...record,
        createdAt: now,
      });
    }
  },
});

export const addJobEvent = internalMutation({
  args: {
    jobId: v.id("jobs"),
    stageKey: v.optional(stageKey),
    level: eventLevel,
    message: v.string(),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await addEvent(ctx, args);
  },
});

export const maybeFinalize = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const stages = await ctx.db
      .query("jobStages")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    const byKey = new Map(stages.map((stage) => [stage.stageKey, stage]));
    const baseline = byKey.get("baseline_run");
    const adapted = byKey.get("adapted_run");
    const finalize = byKey.get("finalize");
    if (!finalize) {
      return;
    }
    if (baseline?.status === "succeeded" && adapted?.status === "succeeded") {
      const now = Date.now();
      await ctx.db.patch(finalize._id, {
        status: "succeeded",
        completedAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(args.jobId, {
        status: "succeeded",
        currentStage: "finalize",
        latestError: undefined,
        updatedAt: now,
      });
      await addEvent(ctx, {
        jobId: args.jobId,
        stageKey: "finalize",
        level: "info",
        message: "Job finalized with baseline and adapted results.",
      });
      return;
    }

    if (baseline?.status === "failed" || adapted?.status === "failed") {
      const now = Date.now();
      await ctx.db.patch(finalize._id, {
        status: "failed",
        error: "One or more required runner stages failed.",
        retryable: true,
        completedAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(args.jobId, {
        status: "partial_failed",
        currentStage: "finalize",
        latestError: "One or more required runner stages failed.",
        updatedAt: now,
      });
    }
  },
});

async function scheduleStage(ctx: MutationCtx, jobId: Id<"jobs">, stage: StageKey) {
  const action = {
    paper_extract: "jobActions:extractPaper",
    adaption_run: "jobActions:runAdaption",
    baseline_run: "jobActions:runBaseline",
    adapted_run: "jobActions:runAdapted",
    finalize: "jobActions:finalizeJob",
  }[stage];
  await ctx.scheduler.runAfter(0, makeFunctionReference<"action">(action), { jobId });
}

async function addEvent(
  ctx: MutationCtx,
  args: {
    jobId: Id<"jobs">;
    stageKey?: StageKey;
    level: "info" | "warn" | "error";
    message: string;
    payload?: unknown;
  }
) {
  await ctx.db.insert("jobEvents", {
    jobId: args.jobId,
    stageKey: args.stageKey,
    level: args.level,
    message: args.message,
    payload: args.payload,
    createdAt: Date.now(),
  });
}

async function requireJob(ctx: QueryCtx | MutationCtx, jobId: Id<"jobs">) {
  const job = await ctx.db.get(jobId);
  if (!job) {
    throw new Error("Job not found");
  }
  return job;
}

async function requireStage(
  ctx: QueryCtx | MutationCtx,
  jobId: Id<"jobs">,
  key: StageKey
) {
  const stage = await findStage(ctx, jobId, key);
  if (!stage) {
    throw new Error(`Stage ${key} not found`);
  }
  return stage;
}

async function findStage(
  ctx: QueryCtx | MutationCtx,
  jobId: Id<"jobs">,
  key: StageKey
) {
  return await ctx.db
    .query("jobStages")
    .withIndex("by_job_stage", (q) => q.eq("jobId", jobId).eq("stageKey", key))
    .first();
}

async function ensurePaper(ctx: MutationCtx, jobId: Id<"jobs">) {
  const job = await requireJob(ctx, jobId);
  const existing = await ctx.db
    .query("papers")
    .withIndex("by_arxiv_id", (q) => q.eq("arxivId", job.arxivId))
    .first();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("papers", {
    arxivId: job.arxivId,
    title: job.title ?? `arXiv:${job.arxivId}`,
    manifest: job.manifest ?? {},
    source: job.manifest ? "extracted" : "hardcoded_fallback",
    createdAt: Date.now(),
  });
}

function orderStages<T extends { stageKey: StageKey }>(stages: T[]) {
  return [...stages].sort(
    (a, b) => STAGE_KEYS.indexOf(a.stageKey) - STAGE_KEYS.indexOf(b.stageKey)
  );
}

function assertAdmin(adminSecret: string | undefined) {
  const expected = process.env.CONVEX_ADMIN_SECRET;
  if (!expected || adminSecret !== expected) {
    throw new Error("Unauthorized");
  }
}

function normalizeArxivUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid arXiv abs or PDF URL");
  }
  if (url.hostname !== "arxiv.org") {
    throw new Error("Enter a valid arXiv abs or PDF URL");
  }
  const pathMatch = url.pathname.match(/^\/(?:abs|pdf)\/([^/?#]+?)(?:\.pdf)?\/?$/i);
  const idMatch = pathMatch?.[1]?.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/i);
  if (!idMatch) {
    throw new Error("Enter a valid arXiv abs or PDF URL");
  }
  return {
    arxivId: idMatch[1],
    absUrl: `https://arxiv.org/abs/${idMatch[1]}`,
    pdfUrl: `https://arxiv.org/pdf/${idMatch[1]}`,
  };
}

function paperSupportForArxivId(arxivId: string) {
  if (arxivId === "2009.05713") {
    return {
      supportKey: "prosa_xlmr_paper_faithful",
      supported: true,
    };
  }
  return {
    supportKey: "unsupported",
    supported: false,
  };
}

function getRetryStageReset(stage: StageKey): StageKey[] {
  switch (stage) {
    case "paper_extract":
      return [...STAGE_KEYS];
    case "adaption_run":
      return ["adaption_run", "adapted_run", "finalize"];
    case "baseline_run":
      return ["baseline_run", "finalize"];
    case "adapted_run":
      return ["adapted_run", "finalize"];
    case "finalize":
      return ["finalize"];
  }
}

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import {
  convexRunToRunResult,
  runResultToConvexInput,
  type ConvexRunInput,
} from "@/lib/convex-records";
import {
  jobSummarySchema,
  type RunRequest,
  type RunResult,
  type JobDetail,
  type JobSummary,
  type StageKey,
  type TrainingSource,
} from "@/lib/contracts";
import { getRuntimeEnv } from "@/lib/env";
import { convexJobDetailToDetail } from "@/lib/job-records";

const listRunsRef = makeFunctionReference<"query">("adaptarxiv:listRuns");
const persistRunRef =
  makeFunctionReference<"mutation">("adaptarxiv:persistRun");
const latestCachedRunRef = makeFunctionReference<"query">(
  "adaptarxiv:latestCachedRun"
);
const listJobsRef = makeFunctionReference<"query">("jobs:listJobs");
const getJobDetailRef = makeFunctionReference<"query">("jobs:getJobDetail");
const createJobRef = makeFunctionReference<"mutation">("jobs:createJob");
const retryJobStageRef = makeFunctionReference<"mutation">(
  "jobs:retryJobStage"
);

export async function listPersistedRuns(): Promise<RunResult[]> {
  if (!hasConvexConfig()) {
    return [];
  }

  const runs = (await fetchQuery(listRunsRef, {})) as unknown[];
  return runs.map(convexRunToRunResult);
}

export async function persistRunResult(
  result: RunResult,
  request: RunRequest
): Promise<void> {
  if (!hasConvexConfig()) {
    return;
  }

  await fetchMutation(
    persistRunRef,
    runResultToConvexInput(result, request) as ConvexRunInput
  );
}

export async function latestCachedRun(
  trainingSource: TrainingSource,
  request: RunRequest
): Promise<RunResult | null> {
  if (!hasConvexConfig()) {
    return null;
  }

  const run = await fetchQuery(latestCachedRunRef, {
    trainingSource,
    request,
  });

  return run ? convexRunToRunResult(run) : null;
}

export async function listJobs(): Promise<JobSummary[]> {
  if (!hasConvexConfig()) {
    return [];
  }

  const jobs = (await fetchQuery(listJobsRef, {})) as unknown[];
  return jobs.map((job) => jobSummarySchema.parse(mapPublicJob(job)));
}

export async function getJobDetail(jobId: string): Promise<JobDetail | null> {
  if (!hasConvexConfig()) {
    return null;
  }

  return convexJobDetailToDetail(
    await fetchQuery(getJobDetailRef, {
      jobId,
    })
  );
}

export async function createJob(arxivUrl: string): Promise<{ jobId: string }> {
  requireConvexConfig();
  const result = (await fetchMutation(createJobRef, {
    adminSecret: getRuntimeEnv().convexAdminSecret,
    arxivUrl,
    autoStart: true,
  })) as { jobId?: string };

  if (!result.jobId) {
    throw new Error("Convex did not return a job id");
  }
  return { jobId: result.jobId };
}

export async function retryJobStage(
  jobId: string,
  stageKey: StageKey
): Promise<void> {
  requireConvexConfig();
  await fetchMutation(retryJobStageRef, {
    adminSecret: getRuntimeEnv().convexAdminSecret,
    jobId,
    stageKey,
  });
}

export function hasConvexConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}

function requireConvexConfig() {
  if (!hasConvexConfig()) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  }
}

function mapPublicJob(input: unknown) {
  if (!input || typeof input !== "object") {
    return input;
  }
  const record = input as Record<string, unknown>;
  return {
    id: String(record._id ?? record.id ?? ""),
    arxivId: record.arxivId,
    arxivUrl: record.arxivUrl,
    absUrl: record.absUrl,
    pdfUrl: record.pdfUrl,
    title: record.title,
    status: record.status,
    currentStage: record.currentStage,
    supportKey: record.supportKey,
    supported: record.supported,
    latestError: record.latestError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

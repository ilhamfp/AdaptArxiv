import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import {
  convexRunToRunResult,
  runResultToConvexInput,
  type ConvexRunInput,
} from "@/lib/convex-records";
import {
  type RunRequest,
  type RunResult,
  type TrainingSource,
} from "@/lib/contracts";

const listRunsRef = makeFunctionReference<"query">("adaptarxiv:listRuns");
const persistRunRef =
  makeFunctionReference<"mutation">("adaptarxiv:persistRun");
const latestCachedRunRef = makeFunctionReference<"query">(
  "adaptarxiv:latestCachedRun"
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

export function hasConvexConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}

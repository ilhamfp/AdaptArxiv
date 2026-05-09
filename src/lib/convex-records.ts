import {
  normalizeRunResult,
  type RunRequest,
  type RunResult,
} from "@/lib/contracts";

export type ConvexRunInput = RunResult & {
  runnerConfig: RunRequest;
  createdAt?: number;
};

export function runResultToConvexInput(
  result: RunResult,
  request: RunRequest
): ConvexRunInput {
  return {
    ...result,
    runnerConfig: request,
  };
}

export function convexRunToRunResult(input: unknown): RunResult {
  return normalizeRunResult(input);
}

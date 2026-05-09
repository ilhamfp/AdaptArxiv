import { getRuntimeEnv } from "@/lib/env";
import {
  normalizeRunResult,
  type RunRequest,
  type RunResult,
} from "@/lib/contracts";

export async function callModalRunner(
  endpoint: "baseline" | "adapt-id",
  request: RunRequest
): Promise<RunResult> {
  const { modalRunnerUrl } = getRuntimeEnv();
  if (!modalRunnerUrl) {
    throw new Error("MODAL_RUNNER_URL is not configured");
  }

  const controller = new AbortController();
  const timeoutMs = endpoint === "baseline" ? 90_000 : 240_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${modalRunnerUrl.replace(/\/$/, "")}/${endpoint}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Modal ${endpoint} failed: ${response.status} ${text}`);
    }

    return normalizeRunResult(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

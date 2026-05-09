import { getRuntimeEnv } from "@/lib/env";
import {
  datasetPreviewSchema,
  normalizeRunResult,
  modalRunResultSchema,
  type DatasetPreview,
  type DatasetPreviewRequest,
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

export async function callModalDatasetPreview(
  request: DatasetPreviewRequest
): Promise<DatasetPreview> {
  const { modalRunnerUrl } = getRuntimeEnv();
  if (!modalRunnerUrl) {
    throw new Error("MODAL_RUNNER_URL is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(
      `${modalRunnerUrl.replace(/\/$/, "")}/dataset-preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Modal dataset-preview failed: ${response.status} ${text}`);
    }

    return datasetPreviewSchema.parse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export async function callModalPaperProof(
  request: RunRequest
): Promise<RunResult[]> {
  const { modalRunnerUrl } = getRuntimeEnv();
  if (!modalRunnerUrl) {
    throw new Error("MODAL_RUNNER_URL is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 900_000);

  try {
    const response = await fetch(
      `${modalRunnerUrl.replace(/\/$/, "")}/paper-proof`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Modal paper-proof failed: ${response.status} ${text}`);
    }

    const body = (await response.json()) as { runs?: unknown[] };
    return (body.runs ?? []).map((run) => modalRunResultSchema.parse(run));
  } finally {
    clearTimeout(timeout);
  }
}

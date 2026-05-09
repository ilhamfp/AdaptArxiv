import type { RunResult, TrainingSource } from "@/lib/contracts";

export type ComparableBar = {
  label: string;
  trainingSource: TrainingSource;
  metricValue: number;
  provenance: RunResult["provenance"];
  testSetHash: string;
};

export type ComparableBars = {
  testSetHash: string | null;
  bars: ComparableBar[];
  rejected: RunResult[];
};

const RUN_LABELS: Record<TrainingSource, string> = {
  indonesian_only: "Indonesian only",
  adaption_id_aug: "Adaption-adapted Indonesian",
};

const RUN_ORDER: Record<TrainingSource, number> = {
  indonesian_only: 0,
  adaption_id_aug: 1,
};

export function buildComparableBars(runs: RunResult[]): ComparableBars {
  if (runs.length === 0) {
    return { testSetHash: null, bars: [], rejected: [] };
  }

  const testSetHash = runs[0].testSetHash;
  const accepted = runs.filter((run) => run.testSetHash === testSetHash);
  const rejected = runs.filter((run) => run.testSetHash !== testSetHash);

  const latestBySource = new Map<TrainingSource, RunResult>();
  for (const run of accepted) {
    latestBySource.set(run.trainingSource, run);
  }

  const bars = Array.from(latestBySource.values())
    .sort((a, b) => RUN_ORDER[a.trainingSource] - RUN_ORDER[b.trainingSource])
    .map((run) => ({
      label: RUN_LABELS[run.trainingSource],
      trainingSource: run.trainingSource,
      metricValue: run.metricValue,
      provenance: run.provenance,
      testSetHash: run.testSetHash,
    }));

  return { testSetHash, bars, rejected };
}

export function formatMetric(value: number): string {
  return value.toFixed(3);
}

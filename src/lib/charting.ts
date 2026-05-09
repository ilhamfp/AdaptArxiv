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
  paper_raw_full: "Paper raw full",
  paper_raw_paired: "Paired raw",
  adaption_adapted_only: "Adaption adapted-only",
};

const RUN_ORDER: Record<TrainingSource, number> = {
  indonesian_only: 0,
  adaption_id_aug: 1,
  paper_raw_full: 0,
  paper_raw_paired: 1,
  adaption_adapted_only: 2,
};

// Sources to hide from the comparison chart. The paired-raw run is a
// methodological control (same row count as adapted, but raw); surfacing it
// in the headline F1 chart makes the baseline vs adapted comparison harder
// to read, so we keep it in run history but exclude it from bars.
const CHART_HIDDEN_SOURCES = new Set<TrainingSource>(["paper_raw_paired"]);

export function buildComparableBars(runs: RunResult[]): ComparableBars {
  if (runs.length === 0) {
    return { testSetHash: null, bars: [], rejected: [] };
  }

  let hasPaperFaithfulRuns = false;
  for (const run of runs) {
    if (run.experiment?.experimentMode === "paper_faithful") {
      hasPaperFaithfulRuns = true;
      break;
    }
  }

  let testSetHash: string | null = null;
  const latestBySource = new Map<TrainingSource, RunResult>();
  const rejected: RunResult[] = [];

  for (const run of runs) {
    if (
      hasPaperFaithfulRuns &&
      run.experiment?.experimentMode !== "paper_faithful"
    ) {
      continue;
    }

    if (!testSetHash) {
      testSetHash = run.testSetHash || null;
    }

    if (run.testSetHash !== testSetHash) {
      rejected.push(run);
      continue;
    }

    if (!latestBySource.has(run.trainingSource)) {
      latestBySource.set(run.trainingSource, run);
    }
  }

  if (!testSetHash) {
    return { testSetHash: null, bars: [], rejected: [] };
  }

  const bars = Array.from(latestBySource.values())
    .filter((run) => !CHART_HIDDEN_SOURCES.has(run.trainingSource))
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

export function buildComparableBarsForJob(
  runs: RunResult[],
  jobId: string
): ComparableBars {
  return buildComparableBars(runs.filter((run) => run.jobId === jobId));
}

export function formatMetric(value: number): string {
  return value.toFixed(3);
}

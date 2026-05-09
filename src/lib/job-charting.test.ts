import { describe, expect, test } from "vitest";

import { buildComparableBarsForJob } from "@/lib/charting";
import type { RunResult } from "@/lib/contracts";

const baseRun = {
  metricName: "f1",
  metricValue: 0.4,
  provenance: "reproduced_live",
  testSetHash: "same",
  durationMs: 100,
  experiment: {
    experimentMode: "paper_faithful",
    experimentType: "A",
    totalData: 500,
    trainRows: 450,
    validRows: 50,
    testRows: 412,
    dataSeed: 1,
    modelSeed: 4,
    preprocessVersion: "paper_load_data_v1",
    featureExtractor: "xlmr.large_fairseq_cls",
    headType: "paper_dropout_linear_sigmoid",
    metricVariant: "macro_f1_threshold_0_5",
  },
} satisfies Partial<RunResult>;

describe("job-scoped charting", () => {
  test("filters runs to the selected job before enforcing same-test-set bars", () => {
    const runs = [
      {
        ...baseRun,
        jobId: "job-a",
        trainingSource: "paper_raw_full",
        metricValue: 0.5,
      },
      {
        ...baseRun,
        jobId: "job-b",
        trainingSource: "paper_raw_full",
        metricValue: 0.9,
      },
      {
        ...baseRun,
        jobId: "job-a",
        trainingSource: "adaption_adapted_only",
        metricValue: 0.6,
      },
      {
        ...baseRun,
        jobId: "job-a",
        trainingSource: "paper_raw_paired",
        metricValue: 0.55,
        testSetHash: "different",
      },
    ] satisfies RunResult[];

    const comparable = buildComparableBarsForJob(runs, "job-a");

    expect(comparable.bars.map((bar) => bar.metricValue)).toEqual([0.5, 0.6]);
    expect(comparable.rejected).toHaveLength(1);
  });
});

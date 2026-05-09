import { describe, expect, it } from "vitest";

import { buildComparableBars } from "@/lib/charting";
import type { RunResult } from "@/lib/contracts";

const baseRun: RunResult = {
  trainingSource: "indonesian_only",
  metricName: "f1",
  metricValue: 0.68,
  provenance: "reproduced_live",
  testSetHash: "fixed-test-set",
  durationMs: 1200,
};

const paperRun: RunResult = {
  ...baseRun,
  trainingSource: "paper_raw_full",
  metricValue: 0.7,
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
};

describe("chart integrity", () => {
  it("keeps only same-test-set runs in comparable bars", () => {
    const bars = buildComparableBars([
      baseRun,
      {
        ...baseRun,
        trainingSource: "adaption_id_aug",
        metricValue: 0.72,
      },
      {
        ...baseRun,
        trainingSource: "adaption_id_aug",
        metricValue: 0.81,
        testSetHash: "other-test-set",
      },
    ]);

    expect(bars.testSetHash).toBe("fixed-test-set");
    expect(bars.rejected).toHaveLength(1);
    expect(bars.bars.map((bar) => bar.trainingSource)).toEqual([
      "indonesian_only",
      "adaption_id_aug",
    ]);
  });

  it("returns an empty chart when no runs are available", () => {
    expect(buildComparableBars([])).toEqual({
      testSetHash: null,
      bars: [],
      rejected: [],
    });
  });

  it("excludes legacy runs when paper-faithful runs are available, and hides the paired-raw control from the chart", () => {
    const bars = buildComparableBars([
      baseRun,
      paperRun,
      {
        ...paperRun,
        trainingSource: "paper_raw_paired",
        metricValue: 0.68,
      },
      {
        ...paperRun,
        trainingSource: "adaption_adapted_only",
        metricValue: 0.76,
      },
    ]);

    expect(bars.bars.map((bar) => bar.trainingSource)).toEqual([
      "paper_raw_full",
      "adaption_adapted_only",
    ]);
  });

  it("keeps the newest run per source when history contains duplicates", () => {
    const bars = buildComparableBars([
      {
        ...paperRun,
        metricValue: 0.81,
      },
      {
        ...paperRun,
        metricValue: 0.62,
      },
    ]);

    expect(bars.bars).toHaveLength(1);
    expect(bars.bars[0]?.metricValue).toBe(0.81);
  });
});

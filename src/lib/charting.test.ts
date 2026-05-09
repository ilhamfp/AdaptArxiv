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
});

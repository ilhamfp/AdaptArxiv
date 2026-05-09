import { describe, expect, it } from "vitest";

import { modalRunResultSchema, normalizeRunResult } from "@/lib/contracts";

describe("run result contracts", () => {
  it("parses Modal run results into the shared UI shape", () => {
    const parsed = modalRunResultSchema.parse({
      trainingSource: "adaption_id_aug",
      metricName: "f1",
      metricValue: 0.731,
      provenance: "reproduced_live",
      testSetHash: "abc123",
      durationMs: 42100,
      modalCallId: "fc-1",
      validation: {
        rowsRequested: 500,
        rowsReturned: 500,
        rowsPassedValidation: 487,
        drops: { language_fail: 8, duplicate: 5 },
      },
      adaption: {
        datasetId: "ds_123",
        scoreBefore: 6.2,
        scoreAfter: 8.4,
        improvementPercent: 35.48,
      },
    });

    expect(normalizeRunResult(parsed)).toMatchObject({
      trainingSource: "adaption_id_aug",
      metricName: "f1",
      metricValue: 0.731,
      provenance: "reproduced_live",
      testSetHash: "abc123",
      validation: { rowsPassedValidation: 487 },
      adaption: { improvementPercent: 35.48 },
    });
  });

  it("rejects paper-reported values as chartable run results", () => {
    expect(() =>
      modalRunResultSchema.parse({
        trainingSource: "indonesian_only",
        metricName: "f1",
        metricValue: 0.79,
        provenance: "reported_in_paper",
        testSetHash: "paper",
        durationMs: 0,
      })
    ).toThrow();
  });
});

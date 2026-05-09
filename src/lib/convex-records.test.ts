import { describe, expect, it } from "vitest";

import {
  runResultToConvexInput,
  convexRunToRunResult,
} from "@/lib/convex-records";
import type { RunResult } from "@/lib/contracts";

describe("Convex run record mapping", () => {
  it("round-trips adapted run metadata without changing the public run shape", () => {
    const result: RunResult = {
      trainingSource: "adaption_id_aug",
      metricName: "f1",
      metricValue: 0.74,
      provenance: "reproduced_live",
      testSetHash: "hash-1",
      durationMs: 21000,
      modalCallId: "call-1",
      validation: {
        rowsRequested: 500,
        rowsReturned: 500,
        rowsPassedValidation: 488,
        drops: { duplicate: 12 },
      },
      adaption: {
        datasetId: "adaption-dataset-1",
        scoreBefore: 6,
        scoreAfter: 8,
        improvementPercent: 33.3,
      },
    };

    const input = runResultToConvexInput(result, {
      arxiv_id: "2009.05713",
      model: "xlm-roberta-base",
      split_seed: 1,
      n_train: 500,
      max_rows: 500,
    });

    expect(input).toMatchObject({
      trainingSource: "adaption_id_aug",
      metricName: "f1",
      metricValue: 0.74,
      validation: { rowsPassedValidation: 488 },
      adaption: { datasetId: "adaption-dataset-1" },
    });

    expect(convexRunToRunResult(input)).toEqual(result);
  });
});

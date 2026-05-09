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
      audit: {
        uploadedRows: 500,
        ingestedRows: 490,
        requestedRows: 490,
        processedRows: 488,
        totalRows: 490,
        downloadedRows: 488,
        passedRows: 408,
        missingSourceIds: ["row-1"],
        missingSourceCount: 1,
        outputShapeCounts: { object: 320, array: 96 },
        parseStatusCounts: { accepted: 408, malformed_completion: 20 },
        parserFallbackCount: 0,
        labelMismatchCount: 7,
        exactRawMatchCount: 3,
        drops: { malformed_completion: 20 },
        textDiagnostics: {
          rawTrain: textStats(),
          adaptedRawOutput: { ...textStats(), uppercaseChars: 8 },
          adaptedAfterPreprocess: textStats(),
          test: textStats(),
        },
        lengthDelta: {
          meanTokens: -1.5,
          medianTokens: -1,
          minTokens: -10,
          maxTokens: 12,
          adaptedLongerPercent: 38,
          adaptedShorterPercent: 55,
        },
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
      audit: { parserFallbackCount: 0 },
    });

    expect(convexRunToRunResult(input)).toEqual(result);
  });
});

function textStats() {
  return {
    rows: 10,
    meanTokens: 12.3,
    medianTokens: 11,
    minTokens: 2,
    maxTokens: 40,
    uppercaseChars: 0,
    punctuationChars: 0,
    uppercasePer1kChars: 0,
    punctuationPer1kChars: 0,
    allLowerNoPunct: true,
  };
}

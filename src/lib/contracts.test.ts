import { describe, expect, it } from "vitest";

import {
  datasetPreviewSchema,
  modalRunResultSchema,
  normalizeRunResult,
} from "@/lib/contracts";

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
      audit: {
        uploadedRows: 450,
        ingestedRows: 436,
        requestedRows: 436,
        processedRows: 435,
        totalRows: 436,
        downloadedRows: 435,
        passedRows: 416,
        missingSourceIds: ["prosa-train-00001"],
        missingSourceCount: 1,
        outputShapeCounts: { object: 320, array: 96 },
        parseStatusCounts: { accepted: 416, malformed_completion: 19 },
        parserFallbackCount: 0,
        labelMismatchCount: 27,
        exactRawMatchCount: 6,
        drops: { malformed_completion: 19 },
        textDiagnostics: {
          rawTrain: textStats(),
          adaptedRawOutput: { ...textStats(), uppercaseChars: 12 },
          adaptedAfterPreprocess: textStats(),
          test: textStats(),
        },
        lengthDelta: {
          meanTokens: -3.5,
          medianTokens: -1,
          minTokens: -24,
          maxTokens: 28,
          adaptedLongerPercent: 43.27,
          adaptedShorterPercent: 52.1,
        },
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
      audit: {
        uploadedRows: 450,
        outputShapeCounts: { object: 320 },
        parserFallbackCount: 0,
      },
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

  it("parses raw and Adaption data preview rows", () => {
    const parsed = datasetPreviewSchema.parse({
      runRequest: {
        arxiv_id: "2009.05713",
        model: "xlm-roberta-base",
        split_seed: 1,
        n_train: 500,
        max_rows: 500,
      },
      trainingSetup: {
        featureModel: "xlm-roberta-base by default",
        featurePooling: "mean pooled last hidden states over attention mask",
        tokenizerMaxLength: 192,
        classifier: "sklearn LogisticRegression",
        classifierMaxIter: 1000,
        classifierRandomState: 1,
        earlyStopping: false,
        fineTuning: false,
        baselineTrainText: "raw selected Indonesian training text",
        adaptedTrainText: "validated Adaption adapted_text only",
        testText: "raw fixed Indonesian test text",
      },
      raw: {
        rowCount: 500,
        labelCounts: { negative: 250, positive: 250 },
        rows: [{ rowIndex: 1, text: "kamar sangat bersih", label: "positive" }],
      },
      adapted: {
        datasetId: "ds_123",
        status: "succeeded",
        rowCount: 490,
        rowsReturned: 488,
        rowsPassedValidation: 408,
        drops: { language_fail: 61, too_short: 19 },
        audit: {
          uploadedRows: 500,
          ingestedRows: 490,
          requestedRows: 490,
          processedRows: 488,
          totalRows: 490,
          downloadedRows: 488,
          passedRows: 408,
          missingSourceIds: ["prosa-train-00100"],
          missingSourceCount: 1,
          outputShapeCounts: { object: 300, array: 80 },
          parseStatusCounts: { accepted: 408, malformed_completion: 20 },
          parserFallbackCount: 0,
          labelMismatchCount: 8,
          exactRawMatchCount: 3,
          drops: { malformed_completion: 20 },
          textDiagnostics: {
            rawTrain: textStats(),
            adaptedRawOutput: { ...textStats(), punctuationChars: 5 },
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
        rows: [
          {
            rowIndex: 1,
            originalText: "kamar sangat bersih",
            adaptedText: "kamar ini sangat bersih dan nyaman untuk keluarga",
            label: "positive",
          },
        ],
      },
      testSet: {
        rowCount: 100,
        labelCounts: { negative: 50, positive: 50 },
        hash: "abc123",
      },
    });

    expect(parsed.adapted?.rowsPassedValidation).toBe(408);
    expect(parsed.adapted?.audit?.parserFallbackCount).toBe(0);
    expect(parsed.raw.rows[0].text).toContain("bersih");
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

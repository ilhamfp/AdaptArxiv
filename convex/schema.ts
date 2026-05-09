import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const trainingSource = v.union(
  v.literal("indonesian_only"),
  v.literal("adaption_id_aug"),
  v.literal("paper_raw_full"),
  v.literal("paper_raw_paired"),
  v.literal("adaption_adapted_only")
);

const provenance = v.union(
  v.literal("reproduced_live"),
  v.literal("cached_completed_run")
);

const stageKey = v.union(
  v.literal("paper_extract"),
  v.literal("adaption_run"),
  v.literal("baseline_run"),
  v.literal("adapted_run"),
  v.literal("finalize")
);

const stageStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("blocked"),
  v.literal("skipped")
);

const jobStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("blocked"),
  v.literal("partial_failed")
);

const runRequest = v.object({
  arxiv_id: v.string(),
  model: v.string(),
  split_seed: v.number(),
  n_train: v.number(),
  max_rows: v.number(),
  experiment_mode: v.optional(v.string()),
  experiment_type: v.optional(v.string()),
  total_data: v.optional(v.number()),
  valid_size: v.optional(v.number()),
  data_seed: v.optional(v.number()),
  model_seed: v.optional(v.number()),
});

const validationSummary = v.object({
  rowsRequested: v.number(),
  rowsReturned: v.number(),
  rowsPassedValidation: v.number(),
  drops: v.record(v.string(), v.number()),
});

const adaptionSummary = v.object({
  datasetId: v.string(),
  scoreBefore: v.optional(v.number()),
  scoreAfter: v.optional(v.number()),
  improvementPercent: v.optional(v.number()),
});

const textCharacteristics = v.object({
  rows: v.number(),
  meanTokens: v.number(),
  medianTokens: v.number(),
  minTokens: v.number(),
  maxTokens: v.number(),
  uppercaseChars: v.number(),
  punctuationChars: v.number(),
  uppercasePer1kChars: v.number(),
  punctuationPer1kChars: v.number(),
  allLowerNoPunct: v.boolean(),
});

const adaptionAudit = v.object({
  uploadedRows: v.number(),
  ingestedRows: v.number(),
  requestedRows: v.number(),
  processedRows: v.number(),
  totalRows: v.number(),
  downloadedRows: v.number(),
  passedRows: v.number(),
  missingSourceIds: v.array(v.string()),
  missingSourceCount: v.number(),
  outputShapeCounts: v.record(v.string(), v.number()),
  parseStatusCounts: v.record(v.string(), v.number()),
  parserFallbackCount: v.number(),
  labelMismatchCount: v.number(),
  exactRawMatchCount: v.number(),
  drops: v.record(v.string(), v.number()),
  textDiagnostics: v.object({
    rawTrain: textCharacteristics,
    adaptedRawOutput: textCharacteristics,
    adaptedAfterPreprocess: textCharacteristics,
    test: textCharacteristics,
  }),
  lengthDelta: v.object({
    meanTokens: v.number(),
    medianTokens: v.number(),
    minTokens: v.number(),
    maxTokens: v.number(),
    adaptedLongerPercent: v.number(),
    adaptedShorterPercent: v.number(),
  }),
});

const experimentMetadata = v.object({
  experimentMode: v.union(v.literal("legacy_demo"), v.literal("paper_faithful")),
  experimentType: v.literal("A"),
  totalData: v.number(),
  trainRows: v.number(),
  validRows: v.number(),
  testRows: v.number(),
  dataSeed: v.number(),
  modelSeed: v.number(),
  preprocessVersion: v.string(),
  featureExtractor: v.string(),
  headType: v.string(),
  metricVariant: v.string(),
});

export default defineSchema({
  jobs: defineTable({
    arxivId: v.string(),
    arxivUrl: v.string(),
    absUrl: v.string(),
    pdfUrl: v.string(),
    title: v.optional(v.string()),
    authors: v.optional(v.array(v.string())),
    manifest: v.optional(v.any()),
    status: jobStatus,
    currentStage: v.optional(stageKey),
    supportKey: v.string(),
    supported: v.boolean(),
    cursorAgentId: v.optional(v.string()),
    cursorRunId: v.optional(v.string()),
    latestError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_arxiv_created", ["arxivId", "createdAt"]),

  jobStages: defineTable({
    jobId: v.id("jobs"),
    stageKey,
    status: stageStatus,
    attempt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
    output: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_job_stage", ["jobId", "stageKey"]),

  jobEvents: defineTable({
    jobId: v.id("jobs"),
    stageKey: v.optional(stageKey),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_job_created", ["jobId", "createdAt"]),

  adaptedDatasets: defineTable({
    jobId: v.id("jobs"),
    datasetId: v.string(),
    status: v.string(),
    rowCount: v.optional(v.union(v.number(), v.null())),
    rowsReturned: v.number(),
    rowsPassedValidation: v.number(),
    drops: v.record(v.string(), v.number()),
    audit: v.optional(adaptionAudit),
    adaption: v.optional(adaptionSummary),
    previewRows: v.optional(v.array(v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_dataset", ["datasetId"]),

  papers: defineTable({
    arxivId: v.string(),
    title: v.string(),
    manifest: v.any(),
    source: v.union(v.literal("extracted"), v.literal("hardcoded_fallback")),
    createdAt: v.number(),
  }).index("by_arxiv_id", ["arxivId"]),

  runs: defineTable({
    jobId: v.optional(v.id("jobs")),
    paperId: v.id("papers"),
    runnerConfig: runRequest,
    trainingSource,
    metricName: v.literal("f1"),
    metricValue: v.number(),
    provenance,
    testSetHash: v.string(),
    durationMs: v.number(),
    modalCallId: v.optional(v.string()),
    validation: v.optional(validationSummary),
    adaption: v.optional(adaptionSummary),
    audit: v.optional(adaptionAudit),
    experiment: v.optional(experimentMetadata),
    createdAt: v.number(),
  })
    .index("by_paper_created", ["paperId", "createdAt"])
    .index("by_paper_source_created", ["paperId", "trainingSource", "createdAt"])
    .index("by_job_created", ["jobId", "createdAt"])
    .index("by_job_source_created", ["jobId", "trainingSource", "createdAt"]),
});

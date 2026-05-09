import { z } from "zod";

export const trainingSourceSchema = z.enum([
  "indonesian_only",
  "adaption_id_aug",
  "paper_raw_full",
  "paper_raw_paired",
  "adaption_adapted_only",
]);

export const provenanceSchema = z.enum([
  "reproduced_live",
  "cached_completed_run",
]);

export const validationSummarySchema = z.object({
  rowsRequested: z.number().int().nonnegative(),
  rowsReturned: z.number().int().nonnegative(),
  rowsPassedValidation: z.number().int().nonnegative(),
  drops: z.record(z.string(), z.number().int().nonnegative()),
});

export const adaptionSummarySchema = z.object({
  datasetId: z.string().min(1),
  scoreBefore: z.number().optional(),
  scoreAfter: z.number().optional(),
  improvementPercent: z.number().optional(),
});

export const textCharacteristicsSchema = z.object({
  rows: z.number().int().nonnegative(),
  meanTokens: z.number(),
  medianTokens: z.number(),
  minTokens: z.number().int().nonnegative(),
  maxTokens: z.number().int().nonnegative(),
  uppercaseChars: z.number().int().nonnegative(),
  punctuationChars: z.number().int().nonnegative(),
  uppercasePer1kChars: z.number(),
  punctuationPer1kChars: z.number(),
  allLowerNoPunct: z.boolean(),
});

export const adaptionAuditSchema = z.object({
  uploadedRows: z.number().int().nonnegative(),
  ingestedRows: z.number().int().nonnegative(),
  requestedRows: z.number().int().nonnegative(),
  processedRows: z.number().int().nonnegative(),
  totalRows: z.number().int().nonnegative(),
  downloadedRows: z.number().int().nonnegative(),
  passedRows: z.number().int().nonnegative(),
  missingSourceIds: z.array(z.string()),
  missingSourceCount: z.number().int().nonnegative(),
  outputShapeCounts: z.record(z.string(), z.number().int().nonnegative()),
  parseStatusCounts: z.record(z.string(), z.number().int().nonnegative()),
  parserFallbackCount: z.number().int().nonnegative(),
  labelMismatchCount: z.number().int().nonnegative(),
  exactRawMatchCount: z.number().int().nonnegative(),
  drops: z.record(z.string(), z.number().int().nonnegative()),
  textDiagnostics: z.object({
    rawTrain: textCharacteristicsSchema,
    adaptedRawOutput: textCharacteristicsSchema,
    adaptedAfterPreprocess: textCharacteristicsSchema,
    test: textCharacteristicsSchema,
  }),
  lengthDelta: z.object({
    meanTokens: z.number(),
    medianTokens: z.number(),
    minTokens: z.number().int(),
    maxTokens: z.number().int(),
    adaptedLongerPercent: z.number(),
    adaptedShorterPercent: z.number(),
  }),
});

export const experimentMetadataSchema = z.object({
  experimentMode: z.enum(["legacy_demo", "paper_faithful"]),
  experimentType: z.literal("A"),
  totalData: z.number().int().positive(),
  trainRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  testRows: z.number().int().nonnegative(),
  dataSeed: z.number().int(),
  modelSeed: z.number().int(),
  preprocessVersion: z.string().min(1),
  featureExtractor: z.string().min(1),
  headType: z.string().min(1),
  metricVariant: z.string().min(1),
});

export const modalRunResultSchema = z.object({
  trainingSource: trainingSourceSchema,
  metricName: z.literal("f1"),
  metricValue: z.number().min(0).max(1),
  provenance: provenanceSchema,
  testSetHash: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  modalCallId: z.string().optional(),
  validation: validationSummarySchema.optional(),
  adaption: adaptionSummarySchema.optional(),
  audit: adaptionAuditSchema.optional(),
  experiment: experimentMetadataSchema.optional(),
});

export const runResultSchema = modalRunResultSchema;

export const paperManifestSchema = z.object({
  arxivId: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  githubUrl: z.string().url(),
  datasetPath: z.string(),
  baselineTask: z.string(),
  baselineMetric: z.literal("f1"),
  reportedReferenceF1: z.number(),
  source: z.literal("hardcoded_fallback"),
});

export type TrainingSource = z.infer<typeof trainingSourceSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type ValidationSummary = z.infer<typeof validationSummarySchema>;
export type AdaptionSummary = z.infer<typeof adaptionSummarySchema>;
export type AdaptionAudit = z.infer<typeof adaptionAuditSchema>;
export type ExperimentMetadata = z.infer<typeof experimentMetadataSchema>;
export type RunResult = z.infer<typeof runResultSchema>;
export type PaperManifest = z.infer<typeof paperManifestSchema>;

export function normalizeRunResult(input: unknown): RunResult {
  return runResultSchema.parse(input);
}

export const runRequestSchema = z
  .object({
    arxiv_id: z.string().default("2009.05713"),
    model: z.string().default("xlmr.large"),
    split_seed: z.number().int().default(1),
    n_train: z.number().int().positive().default(500),
    max_rows: z.number().int().positive().default(500),
    experiment_mode: z
      .enum(["legacy_demo", "paper_faithful"])
      .default("paper_faithful"),
    experiment_type: z.literal("A").default("A"),
    total_data: z.number().int().positive().default(500),
    valid_size: z.number().positive().max(0.9).default(0.1),
    data_seed: z.number().int().default(1),
    model_seed: z.number().int().default(4),
  });

export type RunRequest = z.infer<typeof runRequestSchema>;

export const datasetPreviewRequestSchema = runRequestSchema.extend({
  limit: z.number().int().positive().max(100).default(24),
  adaption_dataset_id: z.string().min(1).optional(),
});

export const datasetPreviewRowSchema = z.object({
  rowIndex: z.number().int().positive(),
  sourceId: z.string().optional(),
  text: z.string().optional(),
  originalText: z.string().nullable().optional(),
  preprocessedOriginalText: z.string().nullable().optional(),
  adaptedTextRaw: z.string().nullable().optional(),
  adaptedText: z.string().optional(),
  preprocessedAdaptedText: z.string().nullable().optional(),
  label: z.string(),
  status: z.string().optional(),
  dropReason: z.string().nullable().optional(),
  outputShape: z.string().optional(),
  parseStatus: z.string().optional(),
  generatedLabel: z.string().nullable().optional(),
});

export const datasetPreviewSchema = z.object({
  runRequest: runRequestSchema,
  trainingSetup: z.object({
    featureModel: z.string(),
    featurePooling: z.string(),
    tokenizerMaxLength: z.number().int(),
    classifier: z.string(),
    classifierMaxIter: z.number().int(),
    classifierRandomState: z.number().int(),
    earlyStopping: z.boolean(),
    earlyStoppingPatience: z.number().int().optional(),
    fineTuning: z.boolean(),
    loss: z.string().optional(),
    optimizer: z.string().optional(),
    scheduler: z.string().optional(),
    threshold: z.number().optional(),
    baselineTrainText: z.string(),
    adaptedTrainText: z.string(),
    testText: z.string(),
  }),
  raw: z.object({
    rowCount: z.number().int().nonnegative(),
    labelCounts: z.record(z.string(), z.number().int().nonnegative()),
    rows: z.array(datasetPreviewRowSchema),
  }),
  validation: z
    .object({
      rowCount: z.number().int().nonnegative(),
      labelCounts: z.record(z.string(), z.number().int().nonnegative()),
      rows: z.array(datasetPreviewRowSchema),
    })
    .optional(),
  adapted: z
    .object({
      datasetId: z.string(),
      status: z.string(),
      rowCount: z.number().nullable().optional(),
      rowsReturned: z.number().int().nonnegative(),
      rowsPassedValidation: z.number().int().nonnegative(),
      drops: z.record(z.string(), z.number().int().nonnegative()),
      audit: adaptionAuditSchema.optional(),
      rows: z.array(datasetPreviewRowSchema),
    })
    .nullable(),
  testSet: z.object({
    rowCount: z.number().int().nonnegative(),
    labelCounts: z.record(z.string(), z.number().int().nonnegative()),
    hash: z.string().min(1),
  }),
});

export type DatasetPreviewRequest = z.infer<typeof datasetPreviewRequestSchema>;
export type DatasetPreview = z.infer<typeof datasetPreviewSchema>;

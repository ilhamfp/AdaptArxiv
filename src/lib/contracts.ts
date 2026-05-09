import { z } from "zod";

export const trainingSourceSchema = z.enum([
  "indonesian_only",
  "adaption_id_aug",
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
export type RunResult = z.infer<typeof runResultSchema>;
export type PaperManifest = z.infer<typeof paperManifestSchema>;

export function normalizeRunResult(input: unknown): RunResult {
  return runResultSchema.parse(input);
}

export const runRequestSchema = z
  .object({
    arxiv_id: z.string().default("2009.05713"),
    model: z.string().default("xlm-roberta-base"),
    split_seed: z.number().int().default(1),
    n_train: z.number().int().positive().default(500),
    max_rows: z.number().int().positive().default(500),
  });

export type RunRequest = z.infer<typeof runRequestSchema>;

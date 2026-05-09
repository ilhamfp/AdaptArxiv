import { v } from "convex/values";
import {
  type GenericDataModel,
  type GenericMutationCtx,
  type GenericQueryCtx,
  mutationGeneric as mutation,
  queryGeneric as query,
} from "convex/server";

const DEMO_PAPER = {
  arxivId: "2009.05713",
  title: "Improving Indonesian Text Classification Using Multilingual Language Model",
  manifest: {
    github_url:
      "https://github.com/ilhamfp/indonesian-text-classification-multilingual",
    dataset_path:
      "DATASET_PROSA env var when set; otherwise Kaggle ilhamfp31/dataset-tripadvisor",
    baseline_task: "Binary Indonesian sentiment classification",
    baseline_metric: "f1",
    reported_reference_f1: 0.79,
    authors: ["Ilham Firdausi Putra", "Ayu Purwarianti"],
  },
  source: "hardcoded_fallback" as const,
};

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

const runInput = {
  jobId: v.optional(v.id("jobs")),
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
};

export const listRuns = query({
  args: {},
  handler: async (ctx) => {
    const paper = await findPaper(ctx);
    if (!paper) {
      return [];
    }

    return await ctx.db
      .query("runs")
      .withIndex("by_paper_created", (q) => q.eq("paperId", paper._id))
      .order("desc")
      .take(20);
  },
});

export const persistRun = mutation({
  args: runInput,
  handler: async (ctx, args) => {
    const paperId = await ensurePaper(ctx);
    await ctx.db.insert("runs", {
      paperId,
      jobId: args.jobId,
      runnerConfig: args.runnerConfig,
      trainingSource: args.trainingSource,
      metricName: args.metricName,
      metricValue: args.metricValue,
      provenance: args.provenance,
      testSetHash: args.testSetHash,
      durationMs: args.durationMs,
      modalCallId: args.modalCallId,
      validation: args.validation,
      adaption: args.adaption,
      audit: args.audit,
      experiment: args.experiment,
      createdAt: Date.now(),
    });
  },
});

export const latestCachedRun = query({
  args: {
    trainingSource,
    request: runRequest,
  },
  handler: async (ctx, args) => {
    const paper = await findPaper(ctx);
    if (!paper) {
      return null;
    }

    const candidates = await ctx.db
      .query("runs")
      .withIndex("by_paper_created", (q) => q.eq("paperId", paper._id))
      .order("desc")
      .take(20);

    const match = candidates.find(
      (run) =>
        run.trainingSource === args.trainingSource &&
        runnerConfigMatches(run.runnerConfig, args.request)
    );

    return match ? { ...match, provenance: "cached_completed_run" as const } : null;
  },
});

export const health = query({
  args: {},
  handler: async (ctx) => {
    await ctx.db.query("papers").take(1);
    return { ok: true };
  },
});

type Ctx =
  | GenericQueryCtx<GenericDataModel>
  | GenericMutationCtx<GenericDataModel>;

async function ensurePaper(ctx: GenericMutationCtx<GenericDataModel>) {
  const existing = await findPaper(ctx);
  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert("papers", {
    ...DEMO_PAPER,
    createdAt: Date.now(),
  });
}

async function findPaper(ctx: Ctx) {
  return await ctx.db
    .query("papers")
    .withIndex("by_arxiv_id", (q) => q.eq("arxivId", DEMO_PAPER.arxivId))
    .first();
}

function runnerConfigMatches(
  config: {
    arxiv_id: string;
    model: string;
    split_seed: number;
    n_train: number;
    max_rows: number;
    experiment_mode?: string;
    experiment_type?: string;
    total_data?: number;
    valid_size?: number;
    data_seed?: number;
    model_seed?: number;
  },
  request: {
    arxiv_id: string;
    model: string;
    split_seed: number;
    n_train: number;
    max_rows: number;
    experiment_mode?: string;
    experiment_type?: string;
    total_data?: number;
    valid_size?: number;
    data_seed?: number;
    model_seed?: number;
  }
) {
  return (
    config.arxiv_id === request.arxiv_id &&
    config.model === request.model &&
    config.split_seed === request.split_seed &&
    config.n_train === request.n_train &&
    config.max_rows === request.max_rows &&
    optionalMatch(config.experiment_mode, request.experiment_mode) &&
    optionalMatch(config.experiment_type, request.experiment_type) &&
    optionalMatch(config.total_data, request.total_data) &&
    optionalMatch(config.valid_size, request.valid_size) &&
    optionalMatch(config.data_seed, request.data_seed) &&
    optionalMatch(config.model_seed, request.model_seed)
  );
}

function optionalMatch<T>(configValue: T | undefined, requestValue: T | undefined) {
  return configValue === requestValue;
}

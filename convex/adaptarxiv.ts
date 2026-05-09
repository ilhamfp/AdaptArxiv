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
  v.literal("adaption_id_aug")
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

const runInput = {
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
  },
  request: {
    arxiv_id: string;
    model: string;
    split_seed: number;
    n_train: number;
    max_rows: number;
  }
) {
  return (
    config.arxiv_id === request.arxiv_id &&
    config.model === request.model &&
    config.split_seed === request.split_seed &&
    config.n_train === request.n_train
  );
}

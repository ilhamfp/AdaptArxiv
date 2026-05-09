import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

export default defineSchema({
  papers: defineTable({
    arxivId: v.string(),
    title: v.string(),
    manifest: v.any(),
    source: v.union(v.literal("extracted"), v.literal("hardcoded_fallback")),
    createdAt: v.number(),
  }).index("by_arxiv_id", ["arxivId"]),

  runs: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_paper_created", ["paperId", "createdAt"])
    .index("by_paper_source_created", ["paperId", "trainingSource", "createdAt"]),
});

import type { PaperManifest } from "@/lib/contracts";

export const DEMO_PAPER: PaperManifest = {
  arxivId: "2009.05713",
  title: "Improving Indonesian Text Classification Using Multilingual Language Model",
  authors: ["Ilham Firdausi Putra", "Ayu Purwarianti"],
  githubUrl:
    "https://github.com/ilhamfp/indonesian-text-classification-multilingual",
  datasetPath:
    "DATASET_PROSA env var for demo; fallback Kaggle: ilhamfp31/dataset-tripadvisor",
  baselineTask: "Binary Indonesian sentiment classification",
  baselineMetric: "f1",
  reportedReferenceF1: 0.79,
  source: "hardcoded_fallback",
};

export const BLUEPRINT_INSTRUCTION =
  "Generate natural Indonesian sentiment-classification training examples. Preserve the original label. Do not invent conflicting sentiment. Return strict JSON with adapted_text and label. Allowed labels: positive, negative.";

export const ACTIVE_RECIPES = {
  deduplication: true,
  prompt_rephrase: true,
  reasoning_traces: false,
};

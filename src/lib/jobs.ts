export const STAGE_KEYS = [
  "paper_extract",
  "adaption_run",
  "baseline_run",
  "adapted_run",
  "finalize",
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "skipped",
] as const;

export type StageStatus = (typeof STAGE_STATUSES)[number];

export const JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "partial_failed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type NormalizedArxivUrl = {
  arxivId: string;
  absUrl: string;
  pdfUrl: string;
};

export type PaperSupport = {
  supportKey: "prosa_xlmr_paper_faithful" | "unsupported";
  supported: boolean;
  reason: string;
};

export type InitialJobStage = {
  stageKey: StageKey;
  status: "pending";
  attempt: 0;
};

const ARXIV_PATH_RE = /^\/(?:abs|pdf)\/([^/?#]+?)(?:\.pdf)?\/?$/i;
const ARXIV_ID_RE = /^(\d{4}\.\d{4,5})(?:v\d+)?$/i;

export function normalizeArxivUrl(input: string): NormalizedArxivUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid arXiv abs or PDF URL");
  }

  if (url.hostname !== "arxiv.org") {
    throw new Error("Enter a valid arXiv abs or PDF URL");
  }

  const pathMatch = url.pathname.match(ARXIV_PATH_RE);
  const idMatch = pathMatch?.[1]?.match(ARXIV_ID_RE);
  if (!idMatch) {
    throw new Error("Enter a valid arXiv abs or PDF URL");
  }

  const arxivId = idMatch[1];
  return {
    arxivId,
    absUrl: `https://arxiv.org/abs/${arxivId}`,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
  };
}

export function paperSupportForArxivId(arxivId: string): PaperSupport {
  if (arxivId === "2009.05713") {
    return {
      supportKey: "prosa_xlmr_paper_faithful",
      supported: true,
      reason: "PROSA Indonesian sentiment with XLM-R paper-faithful harness",
    };
  }

  return {
    supportKey: "unsupported",
    supported: false,
    reason: "Extraction is supported, but live reproduction is not mapped yet.",
  };
}

export function buildInitialJobStages(): InitialJobStage[] {
  return STAGE_KEYS.map((stageKey) => ({
    stageKey,
    status: "pending",
    attempt: 0,
  }));
}

export function getRetryStageReset(stageKey: StageKey): StageKey[] {
  switch (stageKey) {
    case "paper_extract":
      return [...STAGE_KEYS];
    case "adaption_run":
      return ["adaption_run", "adapted_run", "finalize"];
    case "baseline_run":
      return ["baseline_run", "finalize"];
    case "adapted_run":
      return ["adapted_run", "finalize"];
    case "finalize":
      return ["finalize"];
  }
}

import { describe, expect, test } from "vitest";

import {
  buildInitialJobStages,
  getRetryStageReset,
  normalizeArxivUrl,
  paperSupportForArxivId,
} from "@/lib/jobs";

describe("agentic job helpers", () => {
  test("normalizes arXiv abs and PDF URLs to a canonical id and URL", () => {
    expect(normalizeArxivUrl("https://arxiv.org/abs/2009.05713")).toEqual({
      arxivId: "2009.05713",
      absUrl: "https://arxiv.org/abs/2009.05713",
      pdfUrl: "https://arxiv.org/pdf/2009.05713",
    });

    expect(normalizeArxivUrl("https://arxiv.org/pdf/2009.05713v2.pdf")).toEqual({
      arxivId: "2009.05713",
      absUrl: "https://arxiv.org/abs/2009.05713",
      pdfUrl: "https://arxiv.org/pdf/2009.05713",
    });
  });

  test("rejects non-arxiv links", () => {
    expect(() => normalizeArxivUrl("https://example.com/abs/2009.05713")).toThrow(
      "Enter a valid arXiv abs or PDF URL"
    );
  });

  test("marks only the PROSA paper as live reproduction supported", () => {
    expect(paperSupportForArxivId("2009.05713")).toEqual({
      supportKey: "prosa_xlmr_paper_faithful",
      supported: true,
      reason: "PROSA Indonesian sentiment with XLM-R paper-faithful harness",
    });

    expect(paperSupportForArxivId("2401.00001")).toEqual({
      supportKey: "unsupported",
      supported: false,
      reason: "Extraction is supported, but live reproduction is not mapped yet.",
    });
  });

  test("creates deterministic initial stages for a new job", () => {
    expect(buildInitialJobStages()).toEqual([
      { stageKey: "paper_extract", status: "pending", attempt: 0 },
      { stageKey: "adaption_run", status: "pending", attempt: 0 },
      { stageKey: "baseline_run", status: "pending", attempt: 0 },
      { stageKey: "adapted_run", status: "pending", attempt: 0 },
      { stageKey: "finalize", status: "pending", attempt: 0 },
    ]);
  });

  test("retrying adaption resets dependent adapted and final stages only", () => {
    expect(getRetryStageReset("adaption_run")).toEqual([
      "adaption_run",
      "adapted_run",
      "finalize",
    ]);
    expect(getRetryStageReset("baseline_run")).toEqual([
      "baseline_run",
      "finalize",
    ]);
    expect(getRetryStageReset("paper_extract")).toEqual([
      "paper_extract",
      "adaption_run",
      "baseline_run",
      "adapted_run",
      "finalize",
    ]);
  });
});

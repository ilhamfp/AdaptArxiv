import { describe, expect, test } from "vitest";

import {
  convexAdaptedDatasetToRecord,
  convexJobDetailToDetail,
  convexEventToJobEvent,
  convexJobToSummary,
  convexStageToJobStage,
} from "@/lib/job-records";

describe("Convex job record mapping", () => {
  test("maps Convex job documents to public job summaries", () => {
    expect(
      convexJobToSummary({
        _id: "job-1",
        arxivId: "2009.05713",
        arxivUrl: "https://arxiv.org/abs/2009.05713",
        absUrl: "https://arxiv.org/abs/2009.05713",
        pdfUrl: "https://arxiv.org/pdf/2009.05713",
        title: "Paper",
        status: "running",
        currentStage: "baseline_run",
        supportKey: "prosa_xlmr_paper_faithful",
        supported: true,
        createdAt: 1,
        updatedAt: 2,
      })
    ).toEqual({
      id: "job-1",
      arxivId: "2009.05713",
      arxivUrl: "https://arxiv.org/abs/2009.05713",
      absUrl: "https://arxiv.org/abs/2009.05713",
      pdfUrl: "https://arxiv.org/pdf/2009.05713",
      title: "Paper",
      status: "running",
      currentStage: "baseline_run",
      supportKey: "prosa_xlmr_paper_faithful",
      supported: true,
      createdAt: 1,
      updatedAt: 2,
    });
  });

  test("maps stage, event, and adapted dataset records", () => {
    expect(
      convexStageToJobStage({
        _id: "stage-1",
        jobId: "job-1",
        stageKey: "paper_extract",
        status: "succeeded",
        attempt: 1,
        output: { ok: true },
        updatedAt: 4,
      })
    ).toMatchObject({
      id: "stage-1",
      jobId: "job-1",
      stageKey: "paper_extract",
      status: "succeeded",
      attempt: 1,
      output: { ok: true },
    });

    expect(
      convexEventToJobEvent({
        _id: "event-1",
        jobId: "job-1",
        stageKey: "paper_extract",
        level: "info",
        message: "Reading paper",
        createdAt: 5,
      })
    ).toMatchObject({ id: "event-1", message: "Reading paper" });

    expect(
      convexAdaptedDatasetToRecord({
        _id: "dataset-1",
        jobId: "job-1",
        datasetId: "adaption-dataset",
        status: "succeeded",
        rowsReturned: 10,
        rowsPassedValidation: 8,
        drops: { label_mismatch: 2 },
        createdAt: 6,
        updatedAt: 7,
      })
    ).toMatchObject({
      id: "dataset-1",
      jobId: "job-1",
      datasetId: "adaption-dataset",
      rowsPassedValidation: 8,
    });
  });

  test("maps a nested Convex job detail record", () => {
    const detail = convexJobDetailToDetail({
      job: {
        _id: "job-1",
        arxivId: "2009.05713",
        arxivUrl: "https://arxiv.org/abs/2009.05713",
        absUrl: "https://arxiv.org/abs/2009.05713",
        pdfUrl: "https://arxiv.org/pdf/2009.05713",
        status: "succeeded",
        supportKey: "prosa_xlmr_paper_faithful",
        supported: true,
        createdAt: 1,
        updatedAt: 2,
        manifest: {
          arxivId: "2009.05713",
          absUrl: "https://arxiv.org/abs/2009.05713",
          pdfUrl: "https://arxiv.org/pdf/2009.05713",
          title: "Indonesian sentiment",
          authors: ["A"],
          datasetCandidates: [],
          technique: { summary: "XLM-R head" },
          reportedBaseline: { metricName: "f1" },
          supportKey: "prosa_xlmr_paper_faithful",
          supported: true,
          confidence: 0.8,
          evidenceSnippets: [],
        },
      },
      stages: [],
      events: [],
      runs: [],
      adaptedDataset: null,
    });

    expect(detail?.job.id).toBe("job-1");
    expect(detail?.manifest?.title).toBe("Indonesian sentiment");
  });
});

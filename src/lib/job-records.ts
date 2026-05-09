import {
  adaptedDatasetRecordSchema,
  extractedPaperManifestSchema,
  jobDetailSchema,
  jobEventSchema,
  jobStageSchema,
  jobSummarySchema,
  type AdaptedDatasetRecord,
  type JobDetail,
  type JobEvent,
  type JobStage,
  type JobSummary,
} from "@/lib/contracts";

type ConvexRecord = Record<string, unknown> & { _id?: unknown };

function publicId(input: ConvexRecord) {
  return String(input._id ?? input.id ?? "");
}

export function convexJobToSummary(input: ConvexRecord): JobSummary {
  return jobSummarySchema.parse({
    id: publicId(input),
    arxivId: input.arxivId,
    arxivUrl: input.arxivUrl,
    absUrl: input.absUrl,
    pdfUrl: input.pdfUrl,
    title: input.title,
    status: input.status,
    currentStage: input.currentStage,
    supportKey: input.supportKey,
    supported: input.supported,
    latestError: input.latestError,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

export function convexStageToJobStage(input: ConvexRecord): JobStage {
  return jobStageSchema.parse({
    id: publicId(input),
    jobId: String(input.jobId ?? ""),
    stageKey: input.stageKey,
    status: input.status,
    attempt: input.attempt,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    error: input.error,
    retryable: input.retryable,
    output: input.output,
    updatedAt: input.updatedAt,
  });
}

export function convexEventToJobEvent(input: ConvexRecord): JobEvent {
  return jobEventSchema.parse({
    id: publicId(input),
    jobId: String(input.jobId ?? ""),
    stageKey: input.stageKey,
    level: input.level,
    message: input.message,
    payload: input.payload,
    createdAt: input.createdAt,
  });
}

export function convexAdaptedDatasetToRecord(
  input: ConvexRecord
): AdaptedDatasetRecord {
  return adaptedDatasetRecordSchema.parse({
    id: publicId(input),
    jobId: String(input.jobId ?? ""),
    datasetId: input.datasetId,
    status: input.status,
    rowCount: input.rowCount,
    rowsReturned: input.rowsReturned,
    rowsPassedValidation: input.rowsPassedValidation,
    drops: input.drops,
    audit: input.audit,
    adaption: input.adaption,
    previewRows: input.previewRows,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

export function convexJobDetailToDetail(input: unknown): JobDetail | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as {
    job?: ConvexRecord;
    stages?: ConvexRecord[];
    events?: ConvexRecord[];
    runs?: unknown[];
    adaptedDataset?: ConvexRecord | null;
  };
  if (!record.job) {
    return null;
  }

  return jobDetailSchema.parse({
    job: convexJobToSummary(record.job),
    manifest: record.job.manifest
      ? extractedPaperManifestSchema.parse(record.job.manifest)
      : undefined,
    stages: (record.stages ?? []).map(convexStageToJobStage),
    events: (record.events ?? []).map(convexEventToJobEvent),
    runs: record.runs ?? [],
    adaptedDataset: record.adaptedDataset
      ? convexAdaptedDatasetToRecord(record.adaptedDataset)
      : undefined,
  });
}

import { cache } from "react";
import { listPersistedRuns } from "@/lib/repository";
import { buildComparableBars, formatMetric } from "@/lib/charting";
import { DEMO_PAPER } from "@/lib/paper";
import type { RunResult, TrainingSource } from "@/lib/contracts";
import { LivePreviewChart, type PreviewBar } from "./live-preview-chart";

export const revalidate = 60;

const KIND_BY_SOURCE: Record<TrainingSource, "baseline" | "adapted"> = {
  indonesian_only: "baseline",
  adaption_id_aug: "adapted",
};

const cachedListPersistedRuns = cache(async (): Promise<RunResult[]> => {
  try {
    return await listPersistedRuns();
  } catch {
    return [];
  }
});

export async function LivePreviewSection() {
  const runs = await cachedListPersistedRuns();
  const { bars, testSetHash } = buildComparableBars(runs);

  const previewBars: PreviewBar[] = bars.map((bar) => ({
    label: bar.label,
    value: bar.metricValue,
    formatted: formatMetric(bar.metricValue),
    kind: KIND_BY_SOURCE[bar.trainingSource],
  }));

  const baseline = bars.find((b) => b.trainingSource === "indonesian_only");
  const adapted = bars.find((b) => b.trainingSource === "adaption_id_aug");
  const delta =
    baseline && adapted ? adapted.metricValue - baseline.metricValue : null;

  return (
    <LivePreviewChart
      paperTitle={DEMO_PAPER.title}
      referenceF1={DEMO_PAPER.reportedReferenceF1 ?? null}
      bars={previewBars}
      delta={delta}
      hasRuns={previewBars.length > 0}
      latestHash={testSetHash}
    />
  );
}

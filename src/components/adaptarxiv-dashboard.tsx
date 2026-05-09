"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bot,
  Clock,
  ExternalLink,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Rows3,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { buildComparableBars, formatMetric } from "@/lib/charting";
import {
  datasetPreviewSchema,
  jobDetailSchema,
  jobSummarySchema,
  modalRunResultSchema,
  paperManifestSchema,
  type DatasetPreview,
  type JobDetail,
  type JobSummary,
  type PaperManifest,
  type RunResult,
  type StageKey,
} from "@/lib/contracts";
import { ACTIVE_RECIPES, BLUEPRINT_INSTRUCTION } from "@/lib/paper";
import { EASE } from "@/lib/motion";

type Health = {
  ok: boolean;
  missing: string[];
  convexConfigured: boolean;
};

const RUN_REQUEST = {
  arxiv_id: "2009.05713",
  model: "xlmr.large",
  split_seed: 1,
  n_train: 500,
  max_rows: 500,
  experiment_mode: "paper_faithful",
  experiment_type: "A",
  total_data: 500,
  valid_size: 0.1,
  data_seed: 1,
  model_seed: 4,
};

const LEGACY_RUN_REQUEST = {
  arxiv_id: "2009.05713",
  model: "xlm-roberta-base",
  split_seed: 1,
  n_train: 500,
  max_rows: 500,
  experiment_mode: "legacy_demo",
  experiment_type: "A",
  total_data: 500,
  valid_size: 0.1,
  data_seed: 1,
  model_seed: 4,
};

type RunScope =
  | { kind: "job"; jobId: string }
  | { kind: "legacy-proof" };

export function AdaptArxivDashboard() {
  const [paper, setPaper] = useState<PaperManifest | null>(null);
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedScope, setSelectedScope] = useState<RunScope | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [arxivUrl, setArxivUrl] = useState("https://arxiv.org/abs/2009.05713");
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dataPreview, setDataPreview] = useState<DatasetPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadJobDetail = useCallback(async (jobId: string) => {
    const detail = jobDetailSchema.parse(await fetchJson(`/api/jobs/${jobId}`));
    setJobDetail(detail);
  }, []);

  const selectedScopeRef = useRef<RunScope | null>(null);
  useEffect(() => {
    selectedScopeRef.current = selectedScope;
  }, [selectedScope]);

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      const [
        paperResponse,
        runsResponse,
        sessionResponse,
        healthResponse,
        jobsResponse,
      ] = await Promise.all([
        fetchJson("/api/paper"),
        fetchJson("/api/runs"),
        fetchJson("/api/session"),
        fetchJson("/api/health"),
        fetchJson("/api/jobs"),
      ]);

      setPaper(paperManifestSchema.parse(paperResponse));
      const parsedRuns = ((runsResponse as { runs?: unknown[] }).runs ?? []).map(
        (run) => modalRunResultSchema.parse(run)
      );
      setRuns(parsedRuns);
      setAuthenticated(
        Boolean((sessionResponse as { authenticated?: boolean }).authenticated)
      );
      setHealth(healthResponse as Health);
      const parsedJobs = ((jobsResponse as { jobs?: unknown[] }).jobs ?? []).map(
        (job) => jobSummarySchema.parse(job)
      );
      setJobs(parsedJobs);
      const legacyProofRuns = getLegacyProofRuns(parsedRuns);
      const current = selectedScopeRef.current;
      const keepCurrent =
        (current?.kind === "legacy-proof" && legacyProofRuns.length > 0) ||
        (current?.kind === "job" &&
          parsedJobs.some((job) => job.id === current.jobId));
      const nextScope: RunScope | null = keepCurrent
        ? current
        : parsedJobs[0]
          ? { kind: "job", jobId: parsedJobs[0].id }
          : legacyProofRuns.length > 0
            ? { kind: "legacy-proof" }
            : null;

      // Only update state if the scope actually changed — avoids re-rendering
      // and the polling-loop churn that flickered the UI.
      if (
        current?.kind !== nextScope?.kind ||
        (current?.kind === "job" &&
          nextScope?.kind === "job" &&
          current.jobId !== nextScope.jobId)
      ) {
        setSelectedScope(nextScope);
      }
      if (nextScope?.kind === "job") {
        await loadJobDetail(nextScope.jobId);
      } else {
        setJobDetail(null);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [loadJobDetail]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    startTransition(() => {
      void refreshAll();
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshAll, startTransition]);

  useEffect(() => {
    if (selectedScope?.kind !== "job") {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshAll();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [refreshAll, selectedScope?.kind]);

  const selectedJobId =
    selectedScope?.kind === "job" ? selectedScope.jobId : null;
  const selectedLegacyProof = selectedScope?.kind === "legacy-proof";
  const legacyProofRuns = useMemo(() => getLegacyProofRuns(runs), [runs]);
  const activeRuns = useMemo(
    () =>
      selectedLegacyProof
        ? legacyProofRuns
        : selectedJobId
          ? (jobDetail?.runs ?? [])
          : runs,
    [jobDetail?.runs, legacyProofRuns, runs, selectedJobId, selectedLegacyProof]
  );
  const comparable = useMemo(() => buildComparableBars(activeRuns), [activeRuns]);
  const latestAdapted = activeRuns.find(
    (run) =>
      run.trainingSource === "adaption_adapted_only" ||
      run.trainingSource === "adaption_id_aug"
  );
  const latestBaseline = activeRuns.find(
    (run) =>
      run.trainingSource === "paper_raw_full" ||
      run.trainingSource === "indonesian_only"
  );

  async function signIn() {
    setBusyAction("session");
    setError(null);
    try {
      await fetchJson("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setPassword("");
      await refreshAll();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function startJob() {
    setBusyAction("job");
    setError(null);
    try {
      const response = (await fetchJson("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ arxivUrl }),
      })) as { jobId?: string };
      if (!response.jobId) {
        throw new Error("Job creation did not return an id");
      }
      setSelectedScope({ kind: "job", jobId: response.jobId });
      await refreshAll();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function selectJob(jobId: string) {
    setSelectedScope({ kind: "job", jobId });
    setError(null);
    try {
      await loadJobDetail(jobId);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function selectLegacyProof() {
    setSelectedScope({ kind: "legacy-proof" });
    setJobDetail(null);
    setError(null);
  }

  async function retryStage(stageKey: StageKey) {
    if (!selectedJobId) {
      return;
    }
    setBusyAction(`retry-${stageKey}`);
    setError(null);
    try {
      await fetchJson(`/api/jobs/${selectedJobId}/retry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stageKey }),
      });
      await refreshAll();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function runAction(endpoint: "baseline" | "adapt-id") {
    setBusyAction(endpoint);
    setError(null);
    try {
      const result = modalRunResultSchema.parse(
        await fetchJson(`/api/runs/${endpoint}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(LEGACY_RUN_REQUEST),
        })
      );
      setRuns((current) => [result, ...current]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function runPaperProof() {
    setBusyAction("paper-proof");
    setError(null);
    try {
      const response = (await fetchJson("/api/runs/paper-proof", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(RUN_REQUEST),
      })) as { runs?: unknown[] };
      const parsedRuns = (response.runs ?? []).map((run) =>
        modalRunResultSchema.parse(run)
      );
      setRuns((current) => [...parsedRuns, ...current]);
      setSelectedScope({ kind: "legacy-proof" });
      setJobDetail(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function loadDataPreview() {
    setPreviewLoading(true);
    setError(null);
    try {
      const datasetId =
        latestAdapted?.adaption?.datasetId ?? jobDetail?.adaptedDataset?.datasetId;
      const preview = datasetPreviewSchema.parse(
        await fetchJson("/api/dataset-preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...RUN_REQUEST,
            limit: 24,
            ...(datasetId ? { adaption_dataset_id: datasetId } : {}),
          }),
        })
      );
      setDataPreview(preview);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <main className="flex-1 bg-dust">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="border-b border-dark-grey/20 bg-base-foreground"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 md:px-8 md:py-14">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="c-heading-lg-s c-italic-no-uppercase text-foreground">
                Replicate, <em className="c-italic-emphasis">adapt</em>, compare.
              </h1>
              <p className="mt-5 max-w-2xl c-body text-light-grey">
                Drop in an arXiv paper, let the agent extract the setup, then
                compare adapted runs against the baseline on a held-out
                evaluation set.
              </p>
              <form
                className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void startJob();
                }}
              >
                <Input
                  type="url"
                  value={arxivUrl}
                  onChange={(event) => setArxivUrl(event.target.value)}
                  placeholder="https://arxiv.org/abs/2009.05713"
                  className="h-11"
                />
                <Button
                  type="submit"
                  disabled={!authenticated || busyAction !== null || !arxivUrl}
                  className="h-11 gap-2 sm:w-44"
                >
                  {busyAction === "job" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Start run
                </Button>
              </form>
            </div>

            <div className="grid gap-3 sm:min-w-96">
              <StatusStrip health={health} authenticated={authenticated} />
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void signIn();
                }}
              >
                <input
                  type="text"
                  autoComplete="username"
                  value="demo"
                  readOnly
                  aria-hidden="true"
                  tabIndex={-1}
                  className="sr-only"
                />
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10"
                />
                <Button
                  type="submit"
                  disabled={busyAction === "session" || !password}
                  className="h-10 gap-2"
                >
                  {busyAction === "session" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  Unlock
                </Button>
              </form>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Action failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
        className="mx-auto grid max-w-7xl gap-5 px-5 py-8 md:px-8 lg:grid-cols-[280px_minmax(0,1fr)]"
      >
        <aside className="grid content-start gap-5 min-w-0 lg:sticky lg:top-24 lg:self-start">
          <JobList
            jobs={jobs}
            legacyProofRuns={legacyProofRuns}
            selectedScope={selectedScope}
            onSelectJob={(jobId) => void selectJob(jobId)}
            onSelectLegacyProof={selectLegacyProof}
          />
        </aside>

        <div className="grid min-w-0 gap-5">
          {selectedLegacyProof ? (
            <LegacyProofSummary runs={legacyProofRuns} />
          ) : (
            <JobTimeline
              jobDetail={jobDetail}
              authenticated={authenticated}
              busyAction={busyAction}
              onRetry={(stageKey) => void retryStage(stageKey)}
            />
          )}

          <div className="grid gap-5 min-w-0 md:grid-cols-2">
            <ManifestPanel paper={paper} jobDetail={jobDetail} />
            <MetricPanel baseline={latestBaseline} adapted={latestAdapted} />
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="c-heading-xs font-heading uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
                  <Activity className="size-4 text-light-grey" />
                  F1 comparison
                </CardTitle>
                <CardDescription className="c-body-sm text-light-grey">
                  {selectedLegacyProof
                    ? "Scoped to the saved proof run."
                    : selectedJobId
                      ? "Scoped to the selected run. Same model, same evaluation set."
                      : "Same model, same evaluation set. Only training data changes."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-2"
                  disabled={!authenticated || busyAction !== null}
                  onClick={() => void runPaperProof()}
                >
                  {busyAction === "paper-proof" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Run baseline
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={!authenticated || busyAction !== null}
                  onClick={() => void runAction("adapt-id")}
                >
                  {busyAction === "adapt-id" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Run adapted
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80 min-w-0">
                {mounted && comparable.bars.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={comparable.bars}
                      margin={{ top: 18, right: 18, left: 0, bottom: 24 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--ds-light-grey)"
                        strokeOpacity={0.3}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{
                          fill: "var(--ds-light-grey)",
                          fontSize: 12,
                        }}
                        interval={0}
                      />
                      <YAxis
                        domain={[0, 1]}
                        tick={{
                          fill: "var(--ds-light-grey)",
                          fontSize: 12,
                        }}
                      />
                      <ChartTooltip
                        cursor={{
                          fill: "var(--ds-dark-grey)",
                          fillOpacity: 0.06,
                        }}
                        formatter={(value) => [
                          formatMetric(Number(value)),
                          "F1",
                        ]}
                      />
                      <ReferenceLine
                        y={paper?.reportedReferenceF1 ?? 0.79}
                        stroke="var(--ds-aged-binding)"
                        strokeDasharray="6 4"
                        label={{
                          value: "Reference",
                          fill: "var(--ds-aged-binding)",
                          fontSize: 12,
                          position: "insideTopRight",
                        }}
                      />
                      <Bar
                        dataKey="metricValue"
                        fill="var(--ds-dark-grey)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dark-grey/15 bg-base-foreground c-body-sm text-light-grey">
                    Awaiting first result
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 c-body-sm text-light-grey">
                <Badge variant="outline" className="font-mono">
                  evaluation set: {comparable.testSetHash ? comparable.testSetHash.slice(0, 12) : "—"}
                </Badge>
                {comparable.rejected.length > 0 ? (
                  <Badge variant="destructive">
                    {comparable.rejected.length} excluded run
                  </Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="runs" className="w-full min-w-0">
            <TabsList className="w-full max-w-full overflow-x-auto border-b border-dark-grey/20">
              <TabsTrigger
                value="events"
                className="shrink-0 c-link uppercase tracking-[0.18em] whitespace-nowrap data-[active]:text-foreground"
              >
                {selectedLegacyProof ? "Proof notes" : "Run timeline"}
              </TabsTrigger>
              <TabsTrigger
                value="runs"
                className="shrink-0 c-link uppercase tracking-[0.18em] whitespace-nowrap data-[active]:text-foreground"
              >
                Run history
              </TabsTrigger>
              <TabsTrigger
                value="validation"
                className="shrink-0 c-link uppercase tracking-[0.18em] whitespace-nowrap data-[active]:text-foreground"
              >
                Validation
              </TabsTrigger>
              <TabsTrigger
                value="data"
                className="shrink-0 c-link uppercase tracking-[0.18em] whitespace-nowrap data-[active]:text-foreground"
              >
                Data inspect
              </TabsTrigger>
              <TabsTrigger
                value="spec"
                className="shrink-0 c-link uppercase tracking-[0.18em] whitespace-nowrap data-[active]:text-foreground"
              >
                Adapter brief
              </TabsTrigger>
            </TabsList>
            <TabsContent value="events">
              {selectedLegacyProof ? (
                <LegacyProofNotes runs={legacyProofRuns} />
              ) : (
                <JobEvents events={jobDetail?.events ?? []} />
              )}
            </TabsContent>
            <TabsContent value="runs">
              <RunHistory runs={activeRuns} loading={isPending} />
            </TabsContent>
            <TabsContent value="validation">
              <ValidationPanel run={latestAdapted} />
            </TabsContent>
            <TabsContent value="data">
              <DataInspectionPanel
                authenticated={authenticated}
                preview={dataPreview}
                adaptedRun={latestAdapted}
                loading={previewLoading}
                onLoad={() => void loadDataPreview()}
              />
            </TabsContent>
            <TabsContent value="spec">
              <SpecificationPanel />
            </TabsContent>
          </Tabs>
        </div>
      </motion.section>
    </main>
  );
}

function JobTimeline({
  jobDetail,
  authenticated,
  busyAction,
  onRetry,
}: {
  jobDetail: JobDetail | null;
  authenticated: boolean;
  busyAction: string | null;
  onRetry: (stageKey: StageKey) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="c-heading-xs font-heading uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
            <Bot className="size-4 text-light-grey" />
            Run timeline
          </CardTitle>
          <CardDescription className="c-body-sm text-light-grey">
            Each stage extracts, adapts, and evaluates the paper end to end.
          </CardDescription>
        </div>
        {jobDetail ? (
          <Badge variant={jobDetail.job.status === "failed" ? "destructive" : "default"}>
            {jobDetail.job.status.replaceAll("_", " ")}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {!jobDetail ? (
          <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-6 c-body-sm text-light-grey">
            Sign in and submit an arXiv URL to start a tracked run.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {jobDetail.stages.map((stage) => (
              <div
                key={stage.stageKey}
                className="min-w-0 rounded-lg border border-dark-grey/15 bg-base-foreground p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate c-body-sm font-medium text-foreground">{stageLabel(stage.stageKey)}</p>
                    <p className="mt-1 c-small uppercase tracking-[0.16em] text-light-grey">
                      attempt {stage.attempt}
                    </p>
                  </div>
                  <Badge variant={stageStatusVariant(stage.status)} className="shrink-0">
                    {stage.status}
                  </Badge>
                </div>
                {stage.error ? (
                  <p className="mt-3 line-clamp-3 text-xs text-destructive">
                    {stage.error}
                  </p>
                ) : null}
                {stage.retryable ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full gap-2"
                    disabled={
                      !authenticated || busyAction === `retry-${stage.stageKey}`
                    }
                    onClick={() => onRetry(stage.stageKey)}
                  >
                    {busyAction === `retry-${stage.stageKey}` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Retry
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobEvents({ events }: { events: JobDetail["events"] }) {
  return (
    <Card>
      <CardContent className="grid gap-3 p-4">
        {events.length === 0 ? (
          <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-8 text-center c-body-sm text-light-grey">
            No events yet
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex gap-3 rounded-lg border border-dark-grey/15 bg-base-foreground p-3 text-sm"
            >
              <Clock className="mt-0.5 size-4 shrink-0 text-light-grey" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={event.level === "error" ? "destructive" : "outline"}>
                    {event.level}
                  </Badge>
                  {event.stageKey ? (
                    <span className="text-xs text-light-grey">
                      {stageLabel(event.stageKey)}
                    </span>
                  ) : null}
                  <span className="text-xs text-light-grey">
                    {formatTimestamp(event.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-light-grey">{event.message}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function LegacyProofSummary({ runs }: { runs: RunResult[] }) {
  const comparable = buildComparableBars(runs);
  const rawFull = runs.find((run) => run.trainingSource === "paper_raw_full");
  const adapted = runs.find(
    (run) => run.trainingSource === "adaption_adapted_only"
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="c-heading-xs font-heading uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
            <BadgeCheck className="size-4 text-light-grey" />
            Saved proof run
          </CardTitle>
          <CardDescription className="c-body-sm text-light-grey">
            A completed reference run kept available for comparison.
          </CardDescription>
        </div>
        <Badge className="shrink-0">succeeded</Badge>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Metric label="Baseline" value={rawFull?.metricValue} />
        <Metric label="Adapted" value={adapted?.metricValue} />
        <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-3 sm:col-span-2">
          <p className="c-small uppercase tracking-[0.18em] text-light-grey">
            Evaluation set
          </p>
          <p className="mt-2 break-all font-mono text-xs text-light-grey">
            {comparable.testSetHash ?? "—"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LegacyProofNotes({ runs }: { runs: RunResult[] }) {
  const adapted = runs.find(
    (run) => run.trainingSource === "adaption_adapted_only"
  );
  const rowsPassed = adapted?.validation?.rowsPassedValidation;
  const datasetId = adapted?.adaption?.datasetId;

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 c-body-sm text-light-grey">
        <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-3">
          <p className="c-body font-medium text-foreground">Saved proof run</p>
          <p className="mt-2">
            A completed reference run kept available alongside live runs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">{runs.length} runs</Badge>
          <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
            rows passed: {rowsPassed ?? "—"}
          </Badge>
          {datasetId ? (
            <Badge variant="outline" className="font-mono">
              {datasetId.slice(0, 8)}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function JobList({
  jobs,
  legacyProofRuns,
  selectedScope,
  onSelectJob,
  onSelectLegacyProof,
}: {
  jobs: JobSummary[];
  legacyProofRuns: RunResult[];
  selectedScope: RunScope | null;
  onSelectJob: (jobId: string) => void;
  onSelectLegacyProof: () => void;
}) {
  const proofComparable = buildComparableBars(legacyProofRuns);
  const proofAdapted = proofComparable.bars.find(
    (bar) => bar.trainingSource === "adaption_adapted_only"
  );
  const hasProof = legacyProofRuns.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="c-heading-xs font-heading uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
          <Bot className="size-4 text-light-grey" />
          Runs
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {hasProof ? (
          <button
            type="button"
            onClick={onSelectLegacyProof}
            className={`w-full min-w-0 rounded-lg border p-3 text-left c-body-sm transition ${
              selectedScope?.kind === "legacy-proof"
                ? "border-foreground bg-base-foreground"
                : "border-dark-grey/15 bg-base-foreground hover:border-dark-grey/30"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate c-body font-medium text-foreground">Saved proof run</p>
                <p className="mt-1 truncate c-small uppercase tracking-[0.16em] text-light-grey">
                  Reference baseline
                </p>
              </div>
              <Badge className="shrink-0">succeeded</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="c-link uppercase tracking-[0.16em] shrink-0">{legacyProofRuns.length} runs</Badge>
              {proofAdapted ? (
                <Badge variant="outline" className="c-link uppercase tracking-[0.16em] shrink-0 tabular-nums">
                  adapted {formatMetric(proofAdapted.metricValue)}
                </Badge>
              ) : null}
            </div>
          </button>
        ) : null}

        {jobs.length === 0 && !hasProof ? (
          <p className="c-body-sm text-light-grey">No runs yet.</p>
        ) : (
          jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => onSelectJob(job.id)}
              className={`w-full min-w-0 rounded-lg border p-3 text-left c-body-sm transition ${
                selectedScope?.kind === "job" && selectedScope.jobId === job.id
                  ? "border-foreground bg-base-foreground"
                  : "border-dark-grey/15 bg-base-foreground hover:border-dark-grey/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate c-body font-medium text-foreground">
                    {job.title ?? `arXiv:${job.arxivId}`}
                  </p>
                  <p className="mt-1 truncate c-small uppercase tracking-[0.16em] text-light-grey">
                    {job.currentStage ? stageLabel(job.currentStage) : "created"} ·{" "}
                    {formatTimestamp(job.createdAt)}
                  </p>
                </div>
                <Badge
                  variant={job.status === "failed" ? "destructive" : "outline"}
                  className="shrink-0"
                >
                  {job.status.replaceAll("_", " ")}
                </Badge>
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function StatusStrip({
  health,
  authenticated,
}: {
  health: Health | null;
  authenticated: boolean;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-dark-grey/15 bg-base-foreground p-3 c-body-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-light-grey">
          <ShieldCheck className="size-4 text-light-grey" />
          Status
        </span>
        <Badge variant={health?.ok ? "default" : "secondary"}>
          {health?.ok ? "Connected" : "Configuring"}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-light-grey">
          <Lock className="size-4 text-light-grey" />
          Access
        </span>
        <Badge variant={authenticated ? "default" : "outline"}>
          {authenticated ? "Signed in" : "Signed out"}
        </Badge>
      </div>
    </div>
  );
}

function ManifestPanel({
  paper,
  jobDetail,
}: {
  paper: PaperManifest | null;
  jobDetail: JobDetail | null;
}) {
  const manifest = jobDetail?.manifest;
  const title = manifest?.title ?? paper?.title ?? "Loading manifest";
  const authors =
    manifest?.authors?.length ? manifest.authors.join(", ") : paper?.authors.join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="c-heading-xs font-heading uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
          <FileText className="size-4 text-light-grey" />
          Source paper
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 c-body-sm break-words">
        <div className="min-w-0">
          <p className="c-body font-medium text-foreground">{title}</p>
          <p className="mt-1 text-light-grey">
            {authors ?? "Ilham Firdausi Putra, Ayu Purwarianti"}
          </p>
        </div>
        <div className="grid gap-2 text-light-grey min-w-0">
          <Badge variant="outline" className="c-link uppercase tracking-[0.18em] w-fit">
            {manifest ? `${Math.round(manifest.confidence * 100)}% confidence` : "Reported result"}
          </Badge>
          <p>
            Task:{" "}
            {manifest?.technique.task ??
              paper?.baselineTask ??
              "Binary Indonesian sentiment classification"}
          </p>
          <p>
            Technique: {manifest?.technique.name ?? manifest?.technique.model ?? "XLM-R"}
          </p>
          <p>
            Metric:{" "}
            {manifest?.reportedBaseline.metricName.toUpperCase() ??
              paper?.baselineMetric?.toUpperCase() ??
              "F1"}
          </p>
          <p>
            Reference: XLM-R best ~
            {manifest?.reportedBaseline.metricValue ??
              paper?.reportedReferenceF1 ??
              0.79}
          </p>
          <a
            href={manifest?.absUrl ?? "https://arxiv.org/abs/2009.05713"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1 c-link uppercase tracking-[0.16em] text-foreground hover:text-light-grey transition-colors duration-[var(--transition-duration)] ease-[var(--ease-out-quad)]"
          >
            arXiv source <ExternalLink className="size-3.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPanel({
  baseline,
  adapted,
}: {
  baseline?: RunResult;
  adapted?: RunResult;
}) {
  const delta =
    baseline && adapted ? adapted.metricValue - baseline.metricValue : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="c-heading-xs font-heading uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
          <BadgeCheck className="size-4 text-light-grey" />
          Current delta
        </CardTitle>
        <CardDescription className="c-body-sm text-light-grey">
          Adapted vs. baseline on the evaluation set.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Baseline" value={baseline?.metricValue} />
          <Metric label="Adapted" value={adapted?.metricValue} />
        </div>
        <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-3">
          <p className="c-small uppercase tracking-[0.18em] text-light-grey">
            F1 delta
          </p>
          <p className="mt-1 c-heading-sm font-heading text-foreground tabular-nums">
            {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${formatMetric(delta)}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  format = "metric",
}: {
  label: string;
  value?: number;
  format?: "metric" | "integer";
}) {
  return (
    <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-3">
      <p className="c-small uppercase tracking-[0.18em] text-light-grey">
        {label}
      </p>
      <p className="mt-1 c-heading-xs font-heading text-foreground tabular-nums">
        {value === undefined
          ? "—"
          : format === "integer"
            ? value.toLocaleString()
            : formatMetric(value)}
      </p>
    </div>
  );
}

function RunHistory({ runs, loading }: { runs: RunResult[]; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey">Source</TableHead>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey">F1</TableHead>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey">Provenance</TableHead>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey">Hash</TableHead>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center c-body-sm text-light-grey"
                >
                  {loading ? "Loading" : "No runs yet"}
                </TableCell>
              </TableRow>
            ) : (
              runs.map((run, index) => (
                <TableRow key={`${run.trainingSource}-${run.testSetHash}-${index}`}>
                  <TableCell className="c-body-sm font-medium text-foreground">
                    {runLabel(run.trainingSource)}
                  </TableCell>
                  <TableCell className="c-body-sm tabular-nums text-foreground">
                    {formatMetric(run.metricValue)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
                      {run.provenance.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-light-grey">
                    {run.testSetHash.slice(0, 12)}
                  </TableCell>
                  <TableCell className="text-right c-body-sm tabular-nums text-light-grey">
                    {(run.durationMs / 1000).toFixed(1)}s
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function runLabel(source: RunResult["trainingSource"]): string {
  const labels: Record<RunResult["trainingSource"], string> = {
    indonesian_only: "Baseline (original)",
    adaption_id_aug: "Adapted (augmented)",
    paper_raw_full: "Baseline (full)",
    paper_raw_paired: "Baseline (paired)",
    adaption_adapted_only: "Adapted (cleaned)",
  };
  return labels[source];
}

function stageLabel(stage: StageKey): string {
  const labels: Record<StageKey, string> = {
    paper_extract: "Paper extraction",
    adaption_run: "Adapt data",
    baseline_run: "Raw baseline",
    adapted_run: "Adapted run",
    finalize: "Final result",
  };
  return labels[stage];
}

function stageStatusVariant(
  status: JobDetail["stages"][number]["status"]
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "succeeded") {
    return "default";
  }
  if (status === "failed") {
    return "destructive";
  }
  if (status === "running") {
    return "secondary";
  }
  return "outline";
}

function formatTimestamp(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function ValidationPanel({ run }: { run?: RunResult }) {
  const validation = run?.validation;
  const adaption = run?.adaption;
  const audit = run?.audit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="c-heading-xs font-heading uppercase tracking-[0.12em] text-foreground">
          Data validation
        </CardTitle>
        <CardDescription className="c-body-sm text-light-grey">
          Rows are checked for schema, language, duplicates, and leakage.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-3">
        <div className="grid gap-3">
          <Metric
            label="Requested"
            value={validation?.rowsRequested}
            format="integer"
          />
          <Metric
            label="Returned"
            value={validation?.rowsReturned}
            format="integer"
          />
          <Metric
            label="Passed"
            value={validation?.rowsPassedValidation}
            format="integer"
          />
        </div>
        <div className="grid gap-3">
          <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-3">
            <p className="c-small uppercase tracking-[0.18em] text-light-grey">
              Improvement
            </p>
            <p className="mt-1 c-heading-xs font-heading text-foreground tabular-nums">
              {adaption?.improvementPercent === undefined
                ? "—"
                : `${adaption.improvementPercent.toFixed(1)}%`}
            </p>
          </div>
          <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-3 c-body-sm">
            <p className="c-small uppercase tracking-[0.18em] text-light-grey">Drops</p>
            <p className="mt-2 text-light-grey">
              {validation?.drops
                ? Object.entries(validation.drops)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(", ")
                : "Awaiting first run"}
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-3">
            <p className="c-small uppercase tracking-[0.18em] text-light-grey">
              Row accounting
            </p>
            <p className="mt-2 c-body-sm text-light-grey">
              Uploaded{" "}
              <span className="text-foreground tabular-nums">{audit?.uploadedRows ?? "—"}</span>
              , ingested{" "}
              <span className="text-foreground tabular-nums">{audit?.ingestedRows ?? "—"}</span>
              , processed{" "}
              <span className="text-foreground tabular-nums">{audit?.processedRows ?? "—"}</span>
              , downloaded{" "}
              <span className="text-foreground tabular-nums">{audit?.downloadedRows ?? "—"}</span>
              .
            </p>
          </div>
          <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-3 c-body-sm">
            <p className="c-small uppercase tracking-[0.18em] text-light-grey">Parser audit</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
                fallback: {audit?.parserFallbackCount ?? "—"}
              </Badge>
              <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
                label mismatch: {audit?.labelMismatchCount ?? "—"}
              </Badge>
              <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
                raw matches: {audit?.exactRawMatchCount ?? "—"}
              </Badge>
            </div>
            <p className="mt-2 text-light-grey">
              {audit
                ? `Shapes: ${formatCounts(audit.outputShapeCounts) || "none"}`
                : "Awaiting first run"}
            </p>
            <p className="mt-1 text-light-grey">
              {audit
                ? `Parse: ${formatCounts(audit.parseStatusCounts) || "none"}`
                : ""}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DataInspectionPanel({
  authenticated,
  preview,
  adaptedRun,
  loading,
  onLoad,
}: {
  authenticated: boolean;
  preview: DatasetPreview | null;
  adaptedRun?: RunResult;
  loading: boolean;
  onLoad: () => void;
}) {
  const setup = preview?.trainingSetup;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="c-heading-xs font-heading uppercase tracking-[0.12em] text-foreground flex items-center gap-2">
            <Rows3 className="size-4 text-light-grey" />
            Data inspect
          </CardTitle>
          <CardDescription className="c-body-sm text-light-grey">
            Compare original training rows with rows that passed validation.
          </CardDescription>
        </div>
        <Button
          variant="secondary"
          className="w-fit gap-2"
          disabled={!authenticated || loading}
          onClick={onLoad}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Load samples
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5">
        {!authenticated ? (
          <Alert>
            <Lock className="size-4" />
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription>
              Sign in to load training samples.
            </AlertDescription>
          </Alert>
        ) : null}

        {preview ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Metric
                label="Raw train rows"
                value={preview.raw.rowCount}
                format="integer"
              />
              <Metric
                label="Adapted passed"
                value={preview.adapted?.rowsPassedValidation}
                format="integer"
              />
              <Metric
                label="Test rows"
                value={preview.testSet.rowCount}
                format="integer"
              />
              <Metric
                label="Adapter returned"
                value={preview.adapted?.rowsReturned}
                format="integer"
              />
            </div>

            <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-3 text-sm">
              <div className="grid gap-2 md:grid-cols-2">
                <p className="text-light-grey">
                  Baseline trains on{" "}
                  <span className="text-foreground">
                    {setup?.baselineTrainText}
                  </span>
                  .
                </p>
                <p className="text-light-grey">
                  Adapted trains on{" "}
                  <span className="text-foreground">
                    {setup?.adaptedTrainText}
                  </span>
                  .
                </p>
                <p className="text-light-grey">
                  Head:{" "}
                  <span className="text-foreground">
                    {setup?.classifier}, budget {setup?.classifierMaxIter},
                    seed {setup?.classifierRandomState}
                  </span>
                  .
                </p>
                <p className="text-light-grey">
                  Early stopping:{" "}
                  <span className="text-foreground">
                    {setup?.earlyStopping
                      ? `on${
                          setup.earlyStoppingPatience
                            ? `, patience ${setup.earlyStoppingPatience}`
                            : ""
                        }`
                      : "off"}
                  </span>
                  . Fine-tuning:{" "}
                  <span className="text-foreground">
                    {setup?.fineTuning ? "on" : "off"}
                  </span>
                  .
                </p>
                <p className="text-light-grey">
                  Loss and optimizer:{" "}
                  <span className="text-foreground">
                    {[setup?.loss, setup?.optimizer, setup?.scheduler]
                      .filter(Boolean)
                      .join(", ") || "not reported"}
                  </span>
                  .
                </p>
                <p className="text-light-grey">
                  Decision threshold:{" "}
                  <span className="text-foreground">
                    {setup?.threshold ?? 0.5}
                  </span>
                  .
                </p>
              </div>
              <Separator className="my-3 bg-dark-grey/20" />
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="c-link uppercase tracking-[0.16em] font-mono">
                  hash: {preview.testSet.hash.slice(0, 16)}
                </Badge>
                <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
                  raw labels: {formatCounts(preview.raw.labelCounts)}
                </Badge>
                {preview.adapted ? (
                  <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
                    drops: {formatCounts(preview.adapted.drops) || "none"}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="c-link uppercase tracking-[0.16em]">
                    No adapted dataset selected
                  </Badge>
                )}
                {preview.adapted?.audit ? (
                  <>
                    <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
                      fallback: {preview.adapted.audit.parserFallbackCount}
                    </Badge>
                    <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
                      label mismatch: {preview.adapted.audit.labelMismatchCount}
                    </Badge>
                    <Badge variant="outline" className="c-link uppercase tracking-[0.16em]">
                      shapes: {formatCounts(preview.adapted.audit.outputShapeCounts)}
                    </Badge>
                  </>
                ) : null}
              </div>
            </div>

            <Tabs defaultValue="raw" className="w-full">
              <TabsList className="border-b border-dark-grey/20">
                <TabsTrigger
                  value="raw"
                  className="c-link uppercase tracking-[0.18em] data-[active]:text-foreground"
                >
                  Raw train
                </TabsTrigger>
                <TabsTrigger
                  value="adapted"
                  className="c-link uppercase tracking-[0.18em] data-[active]:text-foreground"
                >
                  Adapted output
                </TabsTrigger>
              </TabsList>
              <TabsContent value="raw">
                <PreviewTable mode="raw" rows={preview.raw.rows} />
              </TabsContent>
              <TabsContent value="adapted">
                {preview.adapted ? (
                  <PreviewTable mode="adapted" rows={preview.adapted.rows} />
                ) : (
                  <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-8 text-center c-body-sm text-light-grey">
                    Run an adapted experiment to inspect rows.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="rounded-lg border border-dark-grey/15 bg-base-foreground p-8 text-center c-body-sm text-light-grey">
            {adaptedRun?.adaption?.datasetId
              ? "Load samples to compare original and adapted rows."
              : "Run the baseline first, then load samples for comparison."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewTable({
  mode,
  rows,
}: {
  mode: "raw" | "adapted";
  rows: DatasetPreview["raw"]["rows"];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-dark-grey/15">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey w-16">#</TableHead>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey min-w-40">Source ID</TableHead>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey w-28">Label</TableHead>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey min-w-80">Raw original</TableHead>
              <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey min-w-80">Preprocessed raw</TableHead>
              {mode === "adapted" ? (
                <>
                  <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey min-w-80">Adapted raw output</TableHead>
                  <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey min-w-80">
                    Preprocessed adapted
                  </TableHead>
                  <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey min-w-32">Output</TableHead>
                  <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey min-w-36">Parse</TableHead>
                  <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey min-w-32">Generated label</TableHead>
                  <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey w-28">Status</TableHead>
                  <TableHead className="c-link uppercase tracking-[0.18em] text-light-grey min-w-40">Drop reason</TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={mode === "adapted" ? 12 : 5}
                  className="h-24 text-center text-light-grey"
                >
                  No preview rows available
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={`${mode}-${row.rowIndex}`}>
                  <TableCell className="font-mono text-xs text-light-grey">
                    {row.rowIndex}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-light-grey">
                    {row.sourceId || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.label}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal text-sm leading-6 text-light-grey">
                    {row.originalText || row.text || "-"}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal text-sm leading-6">
                    {row.preprocessedOriginalText || row.text || "-"}
                  </TableCell>
                  {mode === "adapted" ? (
                    <>
                      <TableCell className="max-w-md whitespace-normal text-sm leading-6 text-light-grey">
                        {row.adaptedTextRaw || row.adaptedText || "-"}
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal text-sm leading-6">
                        {row.preprocessedAdaptedText ||
                          row.adaptedText ||
                          row.adaptedTextRaw ||
                          "-"}
                      </TableCell>
                      <TableCell className="text-sm text-light-grey">
                        {row.outputShape || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-light-grey">
                        {row.parseStatus || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {row.generatedLabel || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.status === "passed" ? "default" : "outline"}
                        >
                          {row.status || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-light-grey">
                        {row.dropReason || "-"}
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
    </div>
  );
}

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function SpecificationPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="c-heading-xs font-heading uppercase tracking-[0.12em] text-foreground">
          Adapter brief
        </CardTitle>
        <CardDescription className="c-body-sm text-light-grey">
          Instructions used by the adapter to refine training rows.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Textarea
          value={BLUEPRINT_INSTRUCTION}
          readOnly
          className="min-h-28 c-body-sm font-mono text-foreground"
        />
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACTIVE_RECIPES).map(([recipe, enabled]) => (
            <Badge
              key={recipe}
              variant={enabled ? "default" : "outline"}
              className="c-link uppercase tracking-[0.16em]"
            >
              {recipe.replaceAll("_", " ")}: {enabled ? "on" : "off"}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function getLegacyProofRuns(runs: RunResult[]): RunResult[] {
  return runs.filter(
    (run) =>
      !run.jobId &&
      run.experiment?.experimentMode === "paper_faithful" &&
      run.experiment.totalData === 500
  );
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      json && typeof json === "object" && "error" in json
        ? String(json.error)
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return json;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

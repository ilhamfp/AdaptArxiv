"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Beaker,
  Database,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Rows3,
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
  modalRunResultSchema,
  paperManifestSchema,
  type DatasetPreview,
  type PaperManifest,
  type RunResult,
} from "@/lib/contracts";
import { ACTIVE_RECIPES, BLUEPRINT_INSTRUCTION } from "@/lib/paper";

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

export function AdaptArxivDashboard() {
  const [paper, setPaper] = useState<PaperManifest | null>(null);
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dataPreview, setDataPreview] = useState<DatasetPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    startTransition(() => {
      void refreshAll();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const comparable = useMemo(() => buildComparableBars(runs), [runs]);
  const latestAdapted = runs.find(
    (run) =>
      run.trainingSource === "adaption_adapted_only" ||
      run.trainingSource === "adaption_id_aug"
  );
  const latestBaseline = runs.find(
    (run) =>
      run.trainingSource === "paper_raw_full" ||
      run.trainingSource === "indonesian_only"
  );

  async function refreshAll() {
    setError(null);
    try {
      const [paperResponse, runsResponse, sessionResponse, healthResponse] =
        await Promise.all([
          fetchJson("/api/paper"),
          fetchJson("/api/runs"),
          fetchJson("/api/session"),
          fetchJson("/api/health"),
        ]);

      setPaper(paperManifestSchema.parse(paperResponse));
      setRuns(
        ((runsResponse as { runs?: unknown[] }).runs ?? []).map((run) =>
          modalRunResultSchema.parse(run)
        )
      );
      setAuthenticated(
        Boolean((sessionResponse as { authenticated?: boolean }).authenticated)
      );
      setHealth(healthResponse as Health);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

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
      const datasetId = latestAdapted?.adaption?.datasetId;
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
    <main className="min-h-screen bg-background">
      <section className="border-b border-dark-grey bg-[radial-gradient(circle_at_top_left,rgba(232,217,168,0.08),transparent_38%),linear-gradient(180deg,rgba(196,195,182,0.04),transparent)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8 md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Beaker className="size-3.5" />
                  Demo MVP
                </Badge>
                <Badge
                  variant="outline"
                  className="border-primary/40 text-primary"
                >
                  fixed test set
                </Badge>
              </div>
              <h1 className="text-4xl font-semibold tracking-normal text-balance md:text-6xl">
                AdaptArxiv
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Recreate a controlled Indonesian sentiment baseline, adapt only
                the training rows, and compare F1 on the same frozen test set.
              </p>
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
                  placeholder="Demo admin password"
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
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-5 text-primary" />
                  Same-runner F1
                </CardTitle>
                <CardDescription>
                  The Indonesian test set is never adapted. Only training data
                  changes.
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
                  Paper 500 proof
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
                  Adapt ID
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {mounted && comparable.bars.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={comparable.bars}
                      margin={{ top: 18, right: 18, left: 0, bottom: 24 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.08)"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{
                          fill: "rgba(226,232,240,0.72)",
                          fontSize: 12,
                        }}
                        interval={0}
                      />
                      <YAxis
                        domain={[0, 1]}
                        tick={{
                          fill: "rgba(226,232,240,0.72)",
                          fontSize: 12,
                        }}
                      />
                      <ChartTooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        formatter={(value) => [
                          formatMetric(Number(value)),
                          "F1",
                        ]}
                      />
                      <ReferenceLine
                        y={paper?.reportedReferenceF1 ?? 0.79}
                        stroke="rgba(250,204,21,0.9)"
                        strokeDasharray="6 4"
                        label={{
                          value: "paper-reported, different runner",
                          fill: "rgba(250,204,21,0.9)",
                          fontSize: 12,
                          position: "insideTopRight",
                        }}
                      />
                      <Bar
                        dataKey="metricValue"
                        fill="var(--chart-1)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-background/50 text-sm text-muted-foreground">
                    Waiting for a same-runner result
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">
                  hash: {comparable.testSetHash ?? "waiting for run"}
                </Badge>
                {comparable.rejected.length > 0 ? (
                  <Badge variant="destructive">
                    {comparable.rejected.length} mismatched run hidden
                  </Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="runs" className="w-full">
            <TabsList>
              <TabsTrigger value="runs">Run history</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="data">Data inspect</TabsTrigger>
              <TabsTrigger value="spec">Specification</TabsTrigger>
            </TabsList>
            <TabsContent value="runs">
              <RunHistory runs={runs} loading={isPending} />
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

        <aside className="grid content-start gap-5">
          <ManifestPanel paper={paper} />
          <MetricPanel baseline={latestBaseline} adapted={latestAdapted} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-5 text-primary" />
                Persistence
              </CardTitle>
              <CardDescription>
                Convex stores manifests, run history, adapted dataset metadata,
                and cached fallbacks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Live runs are persisted as immutable rows. When Modal or
                Adaption times out, the API returns the latest matching
                completed run.
              </p>
              <Separator />
              <p>
                Vercel routes use the service-role key server-side only; client
                code never reads Convex deployment secrets.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
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
    <div className="grid gap-2 rounded-lg border border-white/10 bg-card/70 p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          Environment
        </span>
        <Badge variant={health?.ok ? "default" : "secondary"}>
          {health?.ok ? "ready" : "needs keys"}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Lock className="size-4 text-primary" />
          Run access
        </span>
        <Badge variant={authenticated ? "default" : "outline"}>
          {authenticated ? "unlocked" : "locked"}
        </Badge>
      </div>
      {health?.missing?.length ? (
        <p className="text-xs text-muted-foreground">
          Missing: {health.missing.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function ManifestPanel({ paper }: { paper: PaperManifest | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          Paper manifest
        </CardTitle>
        <CardDescription>
          Extracted values are hardcoded for the demo paper.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="font-medium">{paper?.title ?? "Loading manifest"}</p>
          <p className="mt-1 text-muted-foreground">
            {paper?.authors.join(", ") ??
              "Ilham Firdausi Putra, Ayu Purwarianti"}
          </p>
        </div>
        <div className="grid gap-2 text-muted-foreground">
          <Badge variant="outline" className="w-fit">
            reported in paper
          </Badge>
          <p>
            Task:{" "}
            {paper?.baselineTask ?? "Binary Indonesian sentiment classification"}
          </p>
          <p>Metric: {paper?.baselineMetric?.toUpperCase() ?? "F1"}</p>
          <p>Reference: XLM-R best ~{paper?.reportedReferenceF1 ?? 0.79}</p>
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
        <CardTitle className="flex items-center gap-2">
          <BadgeCheck className="size-5 text-primary" />
          Current delta
        </CardTitle>
        <CardDescription>Same runner, same split, same fixed test set.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Baseline" value={baseline?.metricValue} />
          <Metric label="Adapted" value={adapted?.metricValue} />
        </div>
        <div className="rounded-lg border border-white/10 bg-background/60 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            F1 delta
          </p>
          <p className="mt-1 text-3xl font-semibold">
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
    <div className="rounded-lg border border-white/10 bg-background/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">
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
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>F1</TableHead>
              <TableHead>Provenance</TableHead>
              <TableHead>Hash</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {loading ? "Loading runs" : "No completed runs yet"}
                </TableCell>
              </TableRow>
            ) : (
              runs.map((run, index) => (
                <TableRow key={`${run.trainingSource}-${run.testSetHash}-${index}`}>
                  <TableCell className="font-medium">
                    {runLabel(run.trainingSource)}
                  </TableCell>
                  <TableCell>{formatMetric(run.metricValue)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {run.provenance.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {run.testSetHash.slice(0, 12)}
                  </TableCell>
                  <TableCell className="text-right">
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
    indonesian_only: "Legacy Indonesian only",
    adaption_id_aug: "Legacy Adaption-adapted Indonesian",
    paper_raw_full: "Paper raw full",
    paper_raw_paired: "Paired raw",
    adaption_adapted_only: "Adaption adapted-only",
  };
  return labels[source];
}

function ValidationPanel({ run }: { run?: RunResult }) {
  const validation = run?.validation;
  const adaption = run?.adaption;
  const audit = run?.audit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data validation</CardTitle>
        <CardDescription>
          Rows are checked for schema, label, Indonesian language, duplicates,
          and test leakage.
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
          <div className="rounded-lg border border-white/10 bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Adaption evaluator
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {adaption?.improvementPercent === undefined
                ? "—"
                : `${adaption.improvementPercent.toFixed(1)}%`}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-background/60 p-3 text-sm">
            <p className="font-medium">Drops</p>
            <p className="mt-2 text-muted-foreground">
              {validation?.drops
                ? Object.entries(validation.drops)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(", ")
                : "Waiting for adapted run"}
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-lg border border-white/10 bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Adaption accounting
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Uploaded{" "}
              <span className="text-foreground">{audit?.uploadedRows ?? "—"}</span>
              , ingested{" "}
              <span className="text-foreground">{audit?.ingestedRows ?? "—"}</span>
              , processed{" "}
              <span className="text-foreground">{audit?.processedRows ?? "—"}</span>
              , downloaded{" "}
              <span className="text-foreground">{audit?.downloadedRows ?? "—"}</span>
              .
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-background/60 p-3 text-sm">
            <p className="font-medium">Parser audit</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">
                fallback: {audit?.parserFallbackCount ?? "—"}
              </Badge>
              <Badge variant="outline">
                label mismatch: {audit?.labelMismatchCount ?? "—"}
              </Badge>
              <Badge variant="outline">
                raw matches: {audit?.exactRawMatchCount ?? "—"}
              </Badge>
            </div>
            <p className="mt-2 text-muted-foreground">
              {audit
                ? `Shapes: ${formatCounts(audit.outputShapeCounts) || "none"}`
                : "Waiting for audit"}
            </p>
            <p className="mt-1 text-muted-foreground">
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
          <CardTitle className="flex items-center gap-2">
            <Rows3 className="size-5 text-primary" />
            Data inspect
          </CardTitle>
          <CardDescription>
            Compare the sampled raw training rows with rows that survived the
            Adaption validation gate.
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
            <AlertTitle>Unlock required</AlertTitle>
            <AlertDescription>
              Dataset previews use the Modal runner and are gated behind the
              demo admin password.
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
                label="Adaption returned"
                value={preview.adapted?.rowsReturned}
                format="integer"
              />
            </div>

            <div className="rounded-lg border border-white/10 bg-background/60 p-3 text-sm">
              <div className="grid gap-2 md:grid-cols-2">
                <p className="text-muted-foreground">
                  Baseline trains on{" "}
                  <span className="text-foreground">
                    {setup?.baselineTrainText}
                  </span>
                  .
                </p>
                <p className="text-muted-foreground">
                  Adaption trains on{" "}
                  <span className="text-foreground">
                    {setup?.adaptedTrainText}
                  </span>
                  .
                </p>
                <p className="text-muted-foreground">
                  Head:{" "}
                  <span className="text-foreground">
                    {setup?.classifier}, budget {setup?.classifierMaxIter},
                    seed {setup?.classifierRandomState}
                  </span>
                  .
                </p>
                <p className="text-muted-foreground">
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
                <p className="text-muted-foreground">
                  Loss and optimizer:{" "}
                  <span className="text-foreground">
                    {[setup?.loss, setup?.optimizer, setup?.scheduler]
                      .filter(Boolean)
                      .join(", ") || "not reported"}
                  </span>
                  .
                </p>
                <p className="text-muted-foreground">
                  Decision threshold:{" "}
                  <span className="text-foreground">
                    {setup?.threshold ?? 0.5}
                  </span>
                  .
                </p>
              </div>
              <Separator className="my-3" />
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">hash: {preview.testSet.hash.slice(0, 16)}</Badge>
                <Badge variant="outline">
                  raw labels: {formatCounts(preview.raw.labelCounts)}
                </Badge>
                {preview.adapted ? (
                  <Badge variant="outline">
                    drops: {formatCounts(preview.adapted.drops) || "none"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    no Adaption dataset selected
                  </Badge>
                )}
                {preview.adapted?.audit ? (
                  <>
                    <Badge variant="outline">
                      fallback: {preview.adapted.audit.parserFallbackCount}
                    </Badge>
                    <Badge variant="outline">
                      label mismatch: {preview.adapted.audit.labelMismatchCount}
                    </Badge>
                    <Badge variant="outline">
                      shapes: {formatCounts(preview.adapted.audit.outputShapeCounts)}
                    </Badge>
                  </>
                ) : null}
              </div>
            </div>

            <Tabs defaultValue="raw" className="w-full">
              <TabsList>
                <TabsTrigger value="raw">Raw train</TabsTrigger>
                <TabsTrigger value="adapted">Adaption output</TabsTrigger>
              </TabsList>
              <TabsContent value="raw">
                <PreviewTable mode="raw" rows={preview.raw.rows} />
              </TabsContent>
              <TabsContent value="adapted">
                {preview.adapted ? (
                  <PreviewTable mode="adapted" rows={preview.adapted.rows} />
                ) : (
                  <div className="rounded-lg border border-white/10 bg-background/50 p-8 text-center text-sm text-muted-foreground">
                    Run or load an Adaption result before inspecting adapted
                    rows.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="rounded-lg border border-white/10 bg-background/50 p-8 text-center text-sm text-muted-foreground">
            {adaptedRun?.adaption?.datasetId
              ? "Load samples to compare raw and Adaption-passed rows."
              : "Run Paper 500 proof first, then load samples for the paired inspection."}
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
    <div className="overflow-x-auto rounded-lg border border-white/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead className="min-w-40">Source ID</TableHead>
              <TableHead className="w-28">Label</TableHead>
              <TableHead className="min-w-80">Raw original</TableHead>
              <TableHead className="min-w-80">Paper-preprocessed raw</TableHead>
              {mode === "adapted" ? (
                <>
                  <TableHead className="min-w-80">Adaption raw output</TableHead>
                  <TableHead className="min-w-80">
                    Paper-preprocessed adapted
                  </TableHead>
                  <TableHead className="min-w-32">Output</TableHead>
                  <TableHead className="min-w-36">Parse</TableHead>
                  <TableHead className="min-w-32">Generated label</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="min-w-40">Drop reason</TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={mode === "adapted" ? 12 : 5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No preview rows available
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={`${mode}-${row.rowIndex}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.rowIndex}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.sourceId || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.label}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal text-sm leading-6 text-muted-foreground">
                    {row.originalText || row.text || "-"}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal text-sm leading-6">
                    {row.preprocessedOriginalText || row.text || "-"}
                  </TableCell>
                  {mode === "adapted" ? (
                    <>
                      <TableCell className="max-w-md whitespace-normal text-sm leading-6 text-muted-foreground">
                        {row.adaptedTextRaw || row.adaptedText || "-"}
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal text-sm leading-6">
                        {row.preprocessedAdaptedText ||
                          row.adaptedText ||
                          row.adaptedTextRaw ||
                          "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.outputShape || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
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
                      <TableCell className="text-sm text-muted-foreground">
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
        <CardTitle>Blueprint specification</CardTitle>
        <CardDescription>
          Sent to Adaption for Indonesian-only prompt rephrase and deduplication.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Textarea value={BLUEPRINT_INSTRUCTION} readOnly className="min-h-28" />
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACTIVE_RECIPES).map(([recipe, enabled]) => (
            <Badge key={recipe} variant={enabled ? "default" : "outline"}>
              {recipe.replaceAll("_", " ")}: {enabled ? "on" : "off"}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
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

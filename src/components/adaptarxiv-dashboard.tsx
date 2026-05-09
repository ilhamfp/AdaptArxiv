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
  modalRunResultSchema,
  paperManifestSchema,
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
  model: "xlm-roberta-base",
  split_seed: 1,
  n_train: 500,
  max_rows: 500,
};

export function AdaptArxivDashboard() {
  const [paper, setPaper] = useState<PaperManifest | null>(null);
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
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
    (run) => run.trainingSource === "adaption_id_aug"
  );
  const latestBaseline = runs.find(
    (run) => run.trainingSource === "indonesian_only"
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
          body: JSON.stringify(RUN_REQUEST),
        })
      );
      setRuns((current) => [result, ...current]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(42,211,176,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]">
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
                  variant="secondary"
                  className="gap-2"
                  disabled={!authenticated || busyAction !== null}
                  onClick={() => void runAction("baseline")}
                >
                  {busyAction === "baseline" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Baseline
                </Button>
                <Button
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
              <TabsTrigger value="spec">Specification</TabsTrigger>
            </TabsList>
            <TabsContent value="runs">
              <RunHistory runs={runs} loading={isPending} />
            </TabsContent>
            <TabsContent value="validation">
              <ValidationPanel run={latestAdapted} />
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

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">
        {value === undefined ? "—" : formatMetric(value)}
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
                    {run.trainingSource === "indonesian_only"
                      ? "Indonesian only"
                      : "Adaption-adapted Indonesian"}
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

function ValidationPanel({ run }: { run?: RunResult }) {
  const validation = run?.validation;
  const adaption = run?.adaption;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data validation</CardTitle>
        <CardDescription>
          Rows are checked for schema, label, Indonesian language, duplicates,
          and test leakage.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-3">
          <Metric label="Requested" value={validation?.rowsRequested} />
          <Metric label="Returned" value={validation?.rowsReturned} />
          <Metric label="Passed" value={validation?.rowsPassedValidation} />
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
      </CardContent>
    </Card>
  );
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

import { jsonError } from "@/lib/api";
import { runRequestSchema } from "@/lib/contracts";
import { callModalPaperProof } from "@/lib/modal-runner";
import { latestCachedRun, persistRunResult } from "@/lib/repository";
import { assertAdminSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = await assertAdminSession();
  if (authError) {
    return authError;
  }

  const runRequest = runRequestSchema.parse(
    await request.json().catch(() => ({}))
  );

  try {
    const runs = await callModalPaperProof(runRequest);
    await Promise.all(runs.map((run) => persistRunResult(run, runRequest)));
    return Response.json({ runs });
  } catch (error) {
    const cached = await Promise.all([
      latestCachedRun("paper_raw_full", runRequest),
      latestCachedRun("paper_raw_paired", runRequest),
      latestCachedRun("adaption_adapted_only", runRequest),
    ]);
    const runs = cached.filter((run) => run !== null);
    if (runs.length > 0) {
      return Response.json({ runs });
    }

    return jsonError(error, 502);
  }
}

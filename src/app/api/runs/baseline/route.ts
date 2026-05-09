import { jsonError } from "@/lib/api";
import { runRequestSchema } from "@/lib/contracts";
import { callModalRunner } from "@/lib/modal-runner";
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
    const result = await callModalRunner("baseline", runRequest);
    await persistRunResult(result, runRequest);
    return Response.json(result);
  } catch (error) {
    const cached = await latestCachedRun("indonesian_only", runRequest);
    if (cached) {
      return Response.json(cached);
    }

    return jsonError(error, 502);
  }
}

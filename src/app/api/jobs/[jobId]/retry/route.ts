import { z } from "zod";

import { jsonError } from "@/lib/api";
import { stageKeySchema } from "@/lib/contracts";
import { retryJobStage } from "@/lib/repository";
import { assertAdminSession } from "@/lib/session";

export const runtime = "nodejs";

const retrySchema = z.object({
  stageKey: stageKeySchema,
});

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const authError = await assertAdminSession();
  if (authError) {
    return authError;
  }

  const { jobId } = await context.params;
  try {
    const body = retrySchema.parse(await request.json().catch(() => ({})));
    await retryJobStage(jobId, body.stageKey);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}

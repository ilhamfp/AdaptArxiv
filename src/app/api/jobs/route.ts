import { z } from "zod";

import { jsonError } from "@/lib/api";
import { createJob, listJobs } from "@/lib/repository";
import { assertAdminSession } from "@/lib/session";

export const runtime = "nodejs";

const createJobSchema = z.object({
  arxivUrl: z.string().min(1),
});

export async function GET() {
  try {
    return Response.json({ jobs: await listJobs() });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  const authError = await assertAdminSession();
  if (authError) {
    return authError;
  }

  try {
    const body = createJobSchema.parse(await request.json().catch(() => ({})));
    return Response.json(await createJob(body.arxivUrl));
  } catch (error) {
    return jsonError(error, 400);
  }
}

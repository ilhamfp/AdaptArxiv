import { jsonError } from "@/lib/api";
import { getJobDetail } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  try {
    const detail = await getJobDetail(jobId);
    if (!detail) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }
    return Response.json(detail);
  } catch (error) {
    return jsonError(error, 500);
  }
}

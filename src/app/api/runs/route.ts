import { jsonError } from "@/lib/api";
import { listPersistedRuns } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ runs: await listPersistedRuns() });
  } catch (error) {
    return jsonError(error);
  }
}

import { DEMO_PAPER } from "@/lib/paper";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(DEMO_PAPER);
}

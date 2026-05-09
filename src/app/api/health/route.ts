import { getMissingEnv } from "@/lib/env";
import { hasConvexConfig } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET() {
  const missing = getMissingEnv([
    "NEXT_PUBLIC_CONVEX_URL",
    "MODAL_RUNNER_URL",
    "DEMO_ADMIN_PASSWORD",
  ]);

  return Response.json({
    ok: missing.length === 0,
    missing,
    convexConfigured: hasConvexConfig(),
  });
}

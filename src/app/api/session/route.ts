import { getRuntimeEnv } from "@/lib/env";
import {
  clearAdminSession,
  hasAdminSession,
  setAdminSession,
} from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ authenticated: await hasAdminSession() });
}

export async function POST(request: Request) {
  const { demoAdminPassword } = getRuntimeEnv();
  if (!demoAdminPassword) {
    return Response.json(
      { error: "DEMO_ADMIN_PASSWORD is not configured" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;

  if (body?.password !== demoAdminPassword) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  await setAdminSession();
  return Response.json({ authenticated: true });
}

export async function DELETE() {
  await clearAdminSession();
  return Response.json({ authenticated: false });
}

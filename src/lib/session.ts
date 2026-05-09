import { cookies } from "next/headers";

const COOKIE_NAME = "adaptarxiv_admin";
const COOKIE_VALUE = "ok";

export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === COOKIE_VALUE;
}

export async function setAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VERCEL === "1",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function assertAdminSession(): Promise<Response | null> {
  if (await hasAdminSession()) {
    return null;
  }

  return Response.json(
    { error: "Admin session required. Sign in with DEMO_ADMIN_PASSWORD." },
    { status: 401 }
  );
}

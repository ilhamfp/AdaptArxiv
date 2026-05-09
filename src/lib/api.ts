import { ZodError } from "zod";

export function jsonError(error: unknown, status = 500): Response {
  if (error instanceof ZodError) {
    return Response.json(
      { error: "Invalid response shape", details: error.flatten() },
      { status: 502 }
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return Response.json({ error: message }, { status });
}

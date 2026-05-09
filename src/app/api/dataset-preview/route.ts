import { jsonError } from "@/lib/api";
import { datasetPreviewRequestSchema } from "@/lib/contracts";
import { callModalDatasetPreview } from "@/lib/modal-runner";
import { assertAdminSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = await assertAdminSession();
  if (authError) {
    return authError;
  }

  try {
    const previewRequest = datasetPreviewRequestSchema.parse(
      await request.json().catch(() => ({}))
    );
    return Response.json(await callModalDatasetPreview(previewRequest));
  } catch (error) {
    return jsonError(error, 502);
  }
}

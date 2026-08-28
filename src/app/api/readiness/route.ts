import { createReadinessResponse } from "@/operations/readiness";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return createReadinessResponse();
}

import { createHealthResponse } from "@/modules/health/health-response";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return createHealthResponse();
}

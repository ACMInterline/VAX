import {
  checkDatabaseConnection,
  type DatabaseHealth,
} from "@/db/health";

export type DatabaseHealthCheck = () => Promise<DatabaseHealth>;

export async function createHealthResponse(
  checkDatabase: DatabaseHealthCheck = checkDatabaseConnection,
): Promise<Response> {
  const database = await checkDatabase();
  const isHealthy = database === "connected";

  return Response.json(
    {
      status: isHealthy ? "ok" : "degraded",
      database,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

import { z } from "zod";

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(?:ql)?$/ }),
});

export function getDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const result = databaseEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return result.data.DATABASE_URL;
}

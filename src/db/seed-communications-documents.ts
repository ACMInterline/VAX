import type { Database } from "./client";
import { communicationTemplates } from "./schema/communications-documents";
import { canonicalCommunicationTemplates } from "@/modules/communications-documents/templates";

export async function seedCommunicationsDocuments(
  database: Database,
): Promise<void> {
  await database
    .insert(communicationTemplates)
    .values(
      canonicalCommunicationTemplates.map((template) => ({
        ...template,
        status: "ACTIVE" as const,
        activatedAt: new Date(),
      })),
    )
    .onConflictDoNothing();
}

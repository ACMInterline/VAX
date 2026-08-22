import "server-only";
import { notFound } from "next/navigation";

export function requireDevelopmentServer(): void {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
}

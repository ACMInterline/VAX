import type { ReactNode } from "react";
import { requireAdministrationPrincipal } from "./admin-principal";

export default async function AdministrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdministrationPrincipal();
  return children;
}

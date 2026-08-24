import type { ReactNode } from "react";
import { requireIdentityAdminPrincipal } from "./admin-principal";

export default async function IdentityAdministrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireIdentityAdminPrincipal();
  return children;
}

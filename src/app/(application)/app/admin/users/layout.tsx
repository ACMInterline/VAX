import type { ReactNode } from "react";
import { requireIdentityAdminPrincipal } from "../admin-principal";

export default async function UserAdministrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireIdentityAdminPrincipal();
  return children;
}

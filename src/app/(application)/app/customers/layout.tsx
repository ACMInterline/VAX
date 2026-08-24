import type { ReactNode } from "react";
import { requireStaffCrmReadPageContext } from "./_lib/crm-page";

export default async function CustomerCrmLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireStaffCrmReadPageContext();
  return children;
}

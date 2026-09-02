import { redirect } from "next/navigation";
import { requireAdministrationPrincipal } from "./admin-principal";

export const dynamic = "force-dynamic";

export default async function AdministrationPage() {
  const principal = await requireAdministrationPrincipal();
  redirect(
    principal.permissions.has("USER_ADMIN_READ")
      ? "/app/admin/users"
      : "/app/admin/business-authority",
  );
}

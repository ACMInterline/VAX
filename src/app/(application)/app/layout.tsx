import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ApplicationDocument } from "@/components/application/application-document";
import { ApplicationShell } from "@/components/application/application-shell";
import "../../globals.css";
import "./app.css";
import { requireApplicationPrincipal } from "./application-principal";

export const metadata: Metadata = {
  title: "ATTELIER Textile Care",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  const principal = await requireApplicationPrincipal();

  return (
    <ApplicationDocument locale={principal.profile.preferredLocale}>
      <ApplicationShell
        locale={principal.profile.preferredLocale}
        authorization={{
          status: principal.profile.status,
          roles: principal.roles,
          permissions: principal.permissions,
        }}
      >
        {children}
      </ApplicationShell>
    </ApplicationDocument>
  );
}

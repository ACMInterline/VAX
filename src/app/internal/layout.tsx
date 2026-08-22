import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireDevelopmentServer } from "./development-only";
import "./internal.css";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default function InternalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  requireDevelopmentServer();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

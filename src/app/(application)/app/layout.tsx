import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../../globals.css";
import "./app.css";

export const metadata: Metadata = {
  title: "VAX Application",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bg">
      <body className="application-body">
        <a className="skip-link" href="#app-main">
          Към основното съдържание / Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

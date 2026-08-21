import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Service Platform Foundation",
  description: "Technical foundation for a modular service-management platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

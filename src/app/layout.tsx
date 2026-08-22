import type { Metadata } from "next";
import type { ReactNode } from "react";
import { publicLanguageConfig } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { createRootMetadata } from "@/lib/public-metadata";
import "./globals.css";

const homeMetadata = getPublicContent().metadata.home;

export const metadata: Metadata = createRootMetadata(
  homeMetadata.title,
  homeMetadata.description,
);

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang={publicLanguageConfig.renderedLocale}
      data-scroll-behavior="smooth"
    >
      <body>{children}</body>
    </html>
  );
}

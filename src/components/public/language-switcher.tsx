"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  publicLanguageConfig,
  type PublicLocale,
} from "@/config/public-site";
import { getLanguageSwitchHref } from "@/content/public-site/routes";

type LanguageSwitcherProps = {
  locale: PublicLocale;
  label: string;
  languageNames: Record<PublicLocale, string>;
};

export function LanguageSwitcher({
  locale,
  label,
  languageNames,
}: LanguageSwitcherProps) {
  const pathname = usePathname();

  return (
    <nav className="language-switcher" aria-label={label}>
      {publicLanguageConfig.supportedLocales.map((targetLocale) => (
        <Link
          key={targetLocale}
          href={getLanguageSwitchHref(targetLocale, pathname)}
          hrefLang={targetLocale}
          lang={targetLocale}
          aria-current={targetLocale === locale ? "page" : undefined}
          aria-label={languageNames[targetLocale]}
        >
          {targetLocale.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}

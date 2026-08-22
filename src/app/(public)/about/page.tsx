import { AboutPage } from "@/components/public/pages/about-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const locale = "bg";
const pageMetadata = getPublicContent(locale).metadata.about;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/about",
});

export default function Page() {
  return <AboutPage locale={locale} />;
}

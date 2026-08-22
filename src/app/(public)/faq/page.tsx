import { FaqPage } from "@/components/public/pages/faq-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const locale = "bg";
const pageMetadata = getPublicContent(locale).metadata.faq;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/faq",
});

export default function Page() {
  return <FaqPage locale={locale} />;
}

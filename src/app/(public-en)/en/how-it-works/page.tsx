import { HowItWorksPage } from "@/components/public/pages/how-it-works-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const locale = "en";
const pageMetadata = getPublicContent(locale).metadata.howItWorks;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/how-it-works",
});

export default function Page() {
  return <HowItWorksPage locale={locale} />;
}

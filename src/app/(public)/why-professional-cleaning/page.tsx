import { WhyProfessionalPage } from "@/components/public/pages/why-professional-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const locale = "bg";
const pageMetadata = getPublicContent(locale).metadata.whyProfessional;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/why-professional-cleaning",
});

export default function Page() {
  return <WhyProfessionalPage locale={locale} />;
}

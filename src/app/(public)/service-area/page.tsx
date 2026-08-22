import { ServiceAreaPage } from "@/components/public/pages/service-area-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const locale = "bg";
const pageMetadata = getPublicContent(locale).metadata.serviceArea;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/service-area",
});

export default function Page() {
  return <ServiceAreaPage locale={locale} />;
}

import { ServicesPage } from "@/components/public/pages/services-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const locale = "en";
const pageMetadata = getPublicContent(locale).metadata.services;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/services",
});

export default function Page() {
  return <ServicesPage locale={locale} />;
}

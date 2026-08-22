import { ContactPage } from "@/components/public/pages/contact-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const locale = "en";
const pageMetadata = getPublicContent(locale).metadata.contact;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/contact",
});

export default function Page() {
  return <ContactPage locale={locale} />;
}

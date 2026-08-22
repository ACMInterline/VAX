import { RequestPage } from "@/components/public/pages/request-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";

const locale = "en";
const pageMetadata = getPublicContent(locale).metadata.request;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/request",
});

export default function Page() {
  return <RequestPage locale={locale} />;
}

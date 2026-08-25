import { RequestPage } from "@/components/public/pages/request-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";
import { submitPublicRequestEnAction } from "@/app/public-request-actions";

const locale = "en";
const pageMetadata = getPublicContent(locale).metadata.request;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/request",
});

export default function Page() {
  return <RequestPage action={submitPublicRequestEnAction} locale={locale} />;
}

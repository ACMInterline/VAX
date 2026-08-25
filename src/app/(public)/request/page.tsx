import { RequestPage } from "@/components/public/pages/request-page";
import { getPublicContent } from "@/content/public-site";
import { createPageMetadata } from "@/lib/public-metadata";
import { submitPublicRequestBgAction } from "@/app/public-request-actions";

const locale = "bg";
const pageMetadata = getPublicContent(locale).metadata.request;

export const metadata = createPageMetadata({
  locale,
  ...pageMetadata,
  path: "/request",
});

export default function Page() {
  return <RequestPage action={submitPublicRequestBgAction} locale={locale} />;
}

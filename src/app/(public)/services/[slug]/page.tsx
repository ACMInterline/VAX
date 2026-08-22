import { notFound } from "next/navigation";
import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { getService } from "@/content/public-site";
import { serviceSlugs } from "@/content/public-site/routes";
import { createPageMetadata } from "@/lib/public-metadata";

type ServicePageProps = {
  params: Promise<{ slug: string }>;
};

const locale = "bg";

export function generateStaticParams() {
  return serviceSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getService(locale, slug);

  if (!service) return {};

  return createPageMetadata({
    locale,
    title: service.title,
    description: service.summary,
    path: `/services/${service.slug}`,
  });
}

export default async function Page({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getService(locale, slug);

  if (!service) notFound();

  return <ServiceDetailPage service={service} locale={locale} />;
}

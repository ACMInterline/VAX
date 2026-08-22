export type ServiceSlug =
  | "carpet-cleaning"
  | "rug-cleaning"
  | "sofa-upholstery-cleaning"
  | "mattress-cleaning"
  | "office-carpet-cleaning"
  | "delicate-fabric-care";

export type ServiceContent = {
  slug: ServiceSlug;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  summary: string;
  idealFor: readonly string[];
  process: readonly string[];
  carePoints: readonly string[];
  expectations: readonly string[];
  limitations: readonly string[];
  related: readonly ServiceSlug[];
};

export type TreatmentLevel = {
  number: string;
  name: string;
  description: string;
  intendedFor: string;
};

export type FrequentlyAskedQuestion = {
  question: string;
  answer: string;
};

export type PageMetadataContent = {
  title: string;
  description: string;
};

export type PublicSiteContent = {
  locale: "en";
  navigation: {
    primary: readonly { label: string; href: string }[];
    serviceLinks: readonly { label: string; href: string }[];
  };
  metadata: Readonly<Record<string, PageMetadataContent>>;
  services: readonly ServiceContent[];
  treatmentLevels: readonly TreatmentLevel[];
  faqs: readonly FrequentlyAskedQuestion[];
};

import type { PublicLocale } from "@/config/public-site";
import type {
  PublicServiceSlug,
  ServiceCode,
  TreatmentLevelCode,
} from "@/modules/service-catalogue/catalogue";

export type ServiceSlug = PublicServiceSlug;

export type ServiceContent = {
  catalogueCode: ServiceCode;
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
  catalogueCode: TreatmentLevelCode;
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

export type PublicContentCore = {
  locale: PublicLocale;
  navigation: {
    primary: readonly { label: string; href: string }[];
    serviceLinks: readonly { label: string; href: string }[];
  };
  metadata: Readonly<Record<string, PageMetadataContent>>;
  services: readonly ServiceContent[];
  treatmentLevels: readonly TreatmentLevel[];
  faqs: readonly FrequentlyAskedQuestion[];
};

export type SectionIntro = {
  eyebrow: string;
  title: string;
  description?: string;
};

export type HeroCopy = Omit<SectionIntro, "description"> & {
  description: string;
  primaryAction?: string;
  secondaryAction?: string;
};

export type PublicCommonCopy = {
  brand: {
    descriptor: string;
    tagline: string;
    location: string;
    serviceArea: string;
    phonePlaceholder: string;
    emailPlaceholder: string;
    appointmentShort: string;
    appointmentDetail: string;
    primaryCta: string;
  };
  accessibility: {
    skipToContent: string;
    primaryNavigation: string;
    mobileNavigation: string;
    openNavigation: string;
    closeNavigation: string;
    breadcrumb: string;
    languageSelector: string;
    servicePrinciples: string;
  };
  headerRequest: string;
  languageNames: Record<PublicLocale, string>;
  footer: {
    eyebrow: string;
    services: string;
    explore: string;
    contact: string;
    assessmentNotice: string;
    prototypeNotice: string;
  };
  defaultCta: SectionIntro;
  serviceCard: {
    onSite: string;
    explore: string;
  };
  serviceDetail: {
    home: string;
    services: string;
    describeSurface: string;
    seeProcess: string;
    serviceEyebrow: string;
    idealFor: string;
    process: SectionIntro;
    futureImage: string;
    materialEyebrow: string;
    materialTitle: string;
    materialDescription: string;
    expectationsEyebrow: string;
    expectationsTitle: string;
    limitationsEyebrow: string;
    limitationsTitle: string;
    related: SectionIntro;
    visualLabel: string;
  };
  treatmentNote: string;
  visuals: {
    abstractFabric: string;
    surface: string;
    assessedFirst: string;
    onSite: string;
    originalPhotography: string;
  };
};

export type PublicPagesCopy = {
  home: {
    hero: HeroCopy & {
      kicker: string;
      facts: readonly { label: string; value: string }[];
      capacityValue: string;
      capacityLabel: string;
      capacityNote: string;
    };
    trustPoints: readonly string[];
    services: SectionIntro & { action: string };
    onSite: SectionIntro & {
      points: readonly string[];
      note: string;
      photoTitle: string;
      photoNote: string;
    };
    reuse: SectionIntro & { action: string; factors: readonly string[] };
    treatments: SectionIntro;
    preservation: SectionIntro & {
      formulaLead: string;
      formulaJoin: string;
      formulaEnd: string;
      points: readonly string[];
      note: string;
    };
    hygiene: SectionIntro & {
      quote: string;
      boundaryLabel: string;
      note: string;
    };
    audiences: SectionIntro & {
      residential: {
        label: string;
        title: string;
        text: string;
        items: readonly string[];
      };
      business: {
        label: string;
        title: string;
        text: string;
        items: readonly string[];
      };
    };
    process: SectionIntro & {
      steps: readonly { title: string; description: string }[];
    };
    area: SectionIntro & { action: string };
    faq: SectionIntro & { action: string };
  };
  services: {
    hero: HeroCopy;
    breadcrumbs: { home: string; current: string };
    catalogue: SectionIntro;
    capacity: { eyebrow: string; title: string; text: string };
    treatments: SectionIntro;
  };
  howItWorks: {
    hero: HeroCopy;
    breadcrumbs: { home: string; current: string };
    stepsIntro: SectionIntro;
    steps: readonly { title: string; description: string }[];
    treatmentBand: {
      range: string;
      note: string;
      title: string;
      text: string;
    };
    reuse: SectionIntro & { note: string };
  };
  whyProfessional: {
    hero: HeroCopy;
    breadcrumbs: { home: string; current: string };
    pillarsIntro: SectionIntro;
    pillars: readonly { title: string; text: string }[];
    preservation: SectionIntro & {
      text: string;
      points: readonly string[];
      photoTitle: string;
      photoNote: string;
    };
    hygiene: SectionIntro & { text: string; note: string };
  };
  serviceArea: {
    hero: HeroCopy & { visualLabel: string };
    breadcrumbs: { home: string; current: string };
    coverage: readonly {
      label: string;
      title: string;
      text: string;
      tone: "primary" | "standard" | "deferred";
    }[];
    schedule: SectionIntro;
    placesIntro: SectionIntro;
    places: readonly string[];
    cta: SectionIntro;
  };
  about: {
    hero: HeroCopy;
    breadcrumbs: { home: string; current: string };
    statement: SectionIntro;
    principlesIntro: SectionIntro;
    principles: readonly { title: string; text: string }[];
    proof: SectionIntro & {
      text: string;
      note: string;
      photoTitle: string;
      photoNote: string;
    };
  };
  faq: {
    hero: HeroCopy & { countLabel: string };
    breadcrumbs: { home: string; current: string };
    certainty: SectionIntro;
    cta: SectionIntro;
  };
  contact: {
    hero: HeroCopy;
    breadcrumbs: { home: string; current: string };
    cards: {
      phone: { label: string; text: string };
      email: { label: string; text: string };
      area: { label: string; title: string; text: string };
      hours: { label: string; title: string };
    };
    visit: SectionIntro & {
      text: string;
      nextLabel: string;
      nextTitle: string;
      action: string;
    };
  };
  request: {
    hero: HeroCopy & {
      checklistTitle: string;
      checklist: readonly string[];
    };
    breadcrumbs: { home: string; current: string };
    intro: SectionIntro;
    boundaryLabel: string;
    boundaryItems: readonly string[];
  };
  notFound: {
    eyebrow: string;
    title: string;
    text: string;
    homeAction: string;
    servicesAction: string;
  };
};

export type RequestFormCopy = {
  notices: {
    errorTitle: string;
    errorText: string;
    successTitle: string;
    successText: string;
  };
  sections: {
    contact: string;
    property: string;
    services: string;
    condition: string;
    timing: string;
  };
  fields: {
    name: string;
    email: string;
    phone: string;
    district: string;
    districtPlaceholder: string;
    propertyType: string;
    propertyPlaceholder: string;
    propertyOptions: Readonly<Record<string, string>>;
    servicesHint: string;
    estimatedQuantity: string;
    quantityPlaceholder: string;
    quantityHint: string;
    approximateArea: string;
    areaPlaceholder: string;
    areaHint: string;
    condition: string;
    conditionPlaceholder: string;
    stains: string;
    stainsPlaceholder: string;
    stainOptions: Readonly<Record<string, string>>;
    delicateTitle: string;
    delicateHint: string;
    preferredDate: string;
    preferredTime: string;
    timeOptions: Readonly<Record<string, string>>;
    notes: string;
    notesPlaceholder: string;
    notesHint: string;
  };
  upload: { title: string; text: string; button: string };
  submit: { label: string; text: string; button: string };
  validation: {
    nameRequired: string;
    nameTooLong: string;
    emailInvalid: string;
    phoneRequired: string;
    phoneTooLong: string;
    phoneInvalid: string;
    districtRequired: string;
    propertyTypeRequired: string;
    serviceRequired: string;
    conditionRequired: string;
    stainsRequired: string;
    notesTooLong: string;
  };
};

export type PublicSiteCopy = {
  common: PublicCommonCopy;
  pages: PublicPagesCopy;
  requestForm: RequestFormCopy;
};

export type PublicSiteContent = PublicContentCore & PublicSiteCopy;

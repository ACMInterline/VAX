import type {
  CustomerResolutionStatus,
  QuoteStatus,
  RequestSource,
  RequestStatus,
} from "@/modules/request-quote/types";

type RequestQuoteCopy = {
  common: {
    noValue: string;
    open: string;
    back: string;
    submit: string;
    pending: string;
    unavailable: string;
    conflict: string;
    invalid: string;
    saved: string;
  };
  labels: {
    requestStatuses: Record<RequestStatus, string>;
    requestSources: Record<RequestSource, string>;
    resolutionStatuses: Record<CustomerResolutionStatus, string>;
    quoteStatuses: Record<QuoteStatus, string>;
  };
  inbox: {
    eyebrow: string;
    title: string;
    intro: string;
    search: string;
    status: string;
    source: string;
    resolution: string;
    manualReview: string;
    all: string;
    apply: string;
    clear: string;
    empty: string;
    create: string;
  };
  detail: {
    title: (reference: string) => string;
    original: string;
    normalized: string;
    crmResolution: string;
    estimates: string;
    quotes: string;
    timeline: string;
    staffNotes: string;
    customerNotes: string;
    contact: string;
    preferredTiming: string;
    requestVersion: string;
    manualReviewRequired: string;
    noItems: string;
    noEstimates: string;
    noQuotes: string;
    advisoryAvailability: string;
    advisoryOnly: string;
  };
  forms: {
    staffCreateTitle: string;
    customerCreateTitle: string;
    customer: string;
    property: string;
    asset: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string;
    internalNotes: string;
    preferredDate: string;
    preferredWindow: string;
    requestStatus: string;
    resolutionStatus: string;
    expectedVersion: string;
    normalize: string;
    createEstimate: string;
    draftQuote: string;
    issueQuote: string;
    supersedeQuote: string;
    withdrawQuote: string;
  };
  self: {
    requestsTitle: string;
    requestsIntro: string;
    quotesTitle: string;
    createRequest: string;
    noRequests: string;
    noQuotes: string;
    received: string;
    quoteTitle: (reference: string) => string;
    issued: string;
    validUntil: string;
    total: string;
    duration: string;
    terms: string;
    historyNotice: string;
    noAcceptance: string;
    printable: string;
  };
};

const sharedLabels = {
  requestStatuses: {
    SUBMITTED: "Submitted",
    IN_REVIEW: "In review",
    NEEDS_REVIEW: "Needs review",
    READY_TO_QUOTE: "Ready to quote",
    QUOTED: "Quoted",
    CLOSED: "Closed",
    DECLINED: "Declined",
  },
  requestSources: {
    PUBLIC_WEB: "Public website",
    CUSTOMER_PORTAL: "Customer portal",
    STAFF_CREATED: "Created by staff",
  },
  resolutionStatuses: {
    UNRESOLVED: "Unresolved",
    MATCH_CANDIDATE: "Match candidate",
    LINKED: "Linked",
    NEW_CUSTOMER_REQUIRED: "New customer required",
  },
  quoteStatuses: {
    DRAFT: "Draft",
    ISSUED: "Issued",
    SUPERSEDED: "Superseded",
    EXPIRED: "Expired",
    WITHDRAWN: "Withdrawn",
  },
} satisfies RequestQuoteCopy["labels"];

export const requestQuoteContent: Record<"bg" | "en", RequestQuoteCopy> = {
  bg: {
    common: {
      noValue: "Няма стойност",
      open: "Отвори",
      back: "Назад",
      submit: "Запази",
      pending: "Запазване…",
      unavailable: "Действието временно не е достъпно.",
      conflict: "Записът е променен. Презаредете и опитайте отново.",
      invalid: "Проверете въведената информация.",
      saved: "Промяната е запазена.",
    },
    labels: {
      requestStatuses: {
        SUBMITTED: "Получена",
        IN_REVIEW: "В преглед",
        NEEDS_REVIEW: "Нужен е преглед",
        READY_TO_QUOTE: "Готова за оферта",
        QUOTED: "Издадена оферта",
        CLOSED: "Затворена",
        DECLINED: "Отказана",
      },
      requestSources: {
        PUBLIC_WEB: "Публичен сайт",
        CUSTOMER_PORTAL: "Клиентски профил",
        STAFF_CREATED: "Създадена от екипа",
      },
      resolutionStatuses: {
        UNRESOLVED: "Неуточнен клиент",
        MATCH_CANDIDATE: "Възможно съвпадение",
        LINKED: "Свързана",
        NEW_CUSTOMER_REQUIRED: "Нужен е нов клиент",
      },
      quoteStatuses: {
        DRAFT: "Чернова",
        ISSUED: "Издадена",
        SUPERSEDED: "Заменена",
        EXPIRED: "Изтекла",
        WITHDRAWN: "Оттеглена",
      },
    },
    inbox: {
      eyebrow: "Операции",
      title: "Заявки за услуга",
      intro: "Преглед, уточняване, изчисление и оферта без създаване на резервация.",
      search: "Референция на заявка",
      status: "Статус",
      source: "Източник",
      resolution: "Клиент",
      manualReview: "Ръчен преглед",
      all: "Всички",
      apply: "Приложи",
      clear: "Изчисти",
      empty: "Няма заявки за избраните филтри.",
      create: "Нова заявка от екипа",
    },
    detail: {
      title: (reference) => `Заявка ${reference}`,
      original: "Оригинално подадена информация",
      normalized: "Структурирана интерпретация",
      crmResolution: "Свързване с клиент и имот",
      estimates: "Версии на изчислението",
      quotes: "Версии на офертата",
      timeline: "История на събитията",
      staffNotes: "Вътрешни бележки",
      customerNotes: "Бележки от клиента",
      contact: "Контакт",
      preferredTiming: "Предпочитано време",
      requestVersion: "Версия на заявката",
      manualReviewRequired: "Изисква се ръчен преглед",
      noItems: "Все още няма структурирани артикули.",
      noEstimates: "Все още няма изчисление.",
      noQuotes: "Все още няма оферта.",
      advisoryAvailability: "Ориентировъчна наличност",
      advisoryOnly: "Само ориентир — не запазва час или капацитет.",
    },
    forms: {
      staffCreateTitle: "Нова заявка за съществуващ клиент",
      customerCreateTitle: "Нова заявка за моя имот",
      customer: "Клиент",
      property: "Имот",
      asset: "Съществуващ артикул (по избор)",
      contactName: "Име за контакт",
      contactEmail: "Имейл",
      contactPhone: "Телефон",
      notes: "Описание и бележки",
      internalNotes: "Вътрешни бележки",
      preferredDate: "Предпочитана дата",
      preferredWindow: "Предпочитан период",
      requestStatus: "Следващ статус",
      resolutionStatus: "Статус на свързване",
      expectedVersion: "Очаквана версия",
      normalize: "Запази структурирания артикул",
      createEstimate: "Създай нова версия на изчислението",
      draftQuote: "Създай чернова на оферта",
      issueQuote: "Издай офертата",
      supersedeQuote: "Създай заменяща версия",
      withdrawQuote: "Оттегли офертата",
    },
    self: {
      requestsTitle: "Моите заявки",
      requestsIntro: "Заявки, свързани с активния ви клиентски профил.",
      quotesTitle: "Моите оферти",
      createRequest: "Нова заявка",
      noRequests: "Все още нямате свързани заявки.",
      noQuotes: "Все още нямате издадени оферти.",
      received: "Получена",
      quoteTitle: (reference) => `Оферта ${reference}`,
      issued: "Издадена на",
      validUntil: "Валидна до",
      total: "Общо с ДДС",
      duration: "Ориентировъчна продължителност",
      terms: "Условия и допускания",
      historyNotice: "Това е запазена версия на издадена оферта.",
      noAcceptance: "Приемане и резервация все още не са активни. Екипът ще се свърже с вас.",
      printable: "Страницата е подготвена за четене и печат.",
    },
  },
  en: {
    common: {
      noValue: "Not provided",
      open: "Open",
      back: "Back",
      submit: "Save",
      pending: "Saving…",
      unavailable: "This action is temporarily unavailable.",
      conflict: "The record changed. Refresh and try again.",
      invalid: "Check the submitted information.",
      saved: "The change was saved.",
    },
    labels: sharedLabels,
    inbox: {
      eyebrow: "Operations",
      title: "Service requests",
      intro: "Review, normalize, estimate and quote without creating a booking.",
      search: "Request reference",
      status: "Status",
      source: "Source",
      resolution: "Customer resolution",
      manualReview: "Manual review",
      all: "All",
      apply: "Apply",
      clear: "Clear",
      empty: "No requests match the selected filters.",
      create: "New staff request",
    },
    detail: {
      title: (reference) => `Request ${reference}`,
      original: "Original customer submission",
      normalized: "Structured interpretation",
      crmResolution: "Customer and property resolution",
      estimates: "Estimate versions",
      quotes: "Quote versions",
      timeline: "Event timeline",
      staffNotes: "Staff-only notes",
      customerNotes: "Customer notes",
      contact: "Contact",
      preferredTiming: "Preferred timing",
      requestVersion: "Request version",
      manualReviewRequired: "Manual review required",
      noItems: "No normalized items yet.",
      noEstimates: "No estimate has been created yet.",
      noQuotes: "No quote has been created yet.",
      advisoryAvailability: "Advisory availability",
      advisoryOnly: "Advisory only — no time or capacity is reserved.",
    },
    forms: {
      staffCreateTitle: "New request for an existing customer",
      customerCreateTitle: "New request for my property",
      customer: "Customer",
      property: "Property",
      asset: "Existing asset (optional)",
      contactName: "Contact name",
      contactEmail: "Email",
      contactPhone: "Phone",
      notes: "Description and notes",
      internalNotes: "Staff-only notes",
      preferredDate: "Preferred date",
      preferredWindow: "Preferred window",
      requestStatus: "Next status",
      resolutionStatus: "Resolution status",
      expectedVersion: "Expected version",
      normalize: "Save normalized item",
      createEstimate: "Create a new estimate version",
      draftQuote: "Create quote draft",
      issueQuote: "Issue quote",
      supersedeQuote: "Create superseding version",
      withdrawQuote: "Withdraw quote",
    },
    self: {
      requestsTitle: "My requests",
      requestsIntro: "Requests attached to your current active customer link.",
      quotesTitle: "My quotes",
      createRequest: "New request",
      noRequests: "You do not have any linked requests yet.",
      noQuotes: "You do not have any issued quotes yet.",
      received: "Received",
      quoteTitle: (reference) => `Quote ${reference}`,
      issued: "Issued",
      validUntil: "Valid until",
      total: "Total including VAT",
      duration: "Estimated duration",
      terms: "Terms and assumptions",
      historyNotice: "This is a preserved version of an issued quote.",
      noAcceptance: "Acceptance and booking are not active yet. The team will contact you.",
      printable: "This page is prepared for clear reading and printing.",
    },
  },
};

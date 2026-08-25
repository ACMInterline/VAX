import type { AuthLocale } from "@/auth/validation";
import type {
  AcceptanceActorType,
  BookingStatus,
  CancellationReasonCategory,
  SchedulingStatus,
  StaffAcceptanceSource,
} from "@/modules/booking-engine/types";

export type BookingCopy = {
  common: {
    noValue: string;
    open: string;
    back: string;
    retry: string;
    all: string;
    apply: string;
    clear: string;
    unavailable: string;
    invalid: string;
    conflict: string;
  };
  labels: {
    bookingStatuses: Record<BookingStatus, string>;
    schedulingStatuses: Record<SchedulingStatus, string>;
    acceptanceActorTypes: Record<AcceptanceActorType, string>;
    staffAcceptanceSources: Record<StaffAcceptanceSource, string>;
    cancellationReasons: Record<CancellationReasonCategory, string>;
  };
  acceptance: {
    customerTitle: string;
    customerIntro: string;
    acknowledgement: string;
    scheduleDisclaimer: string;
    noPaymentDisclaimer: string;
    submit: string;
    pending: string;
    accepted: string;
    existing: string;
    reviewRequired: string;
    unavailable: string;
    staffTitle: string;
    staffIntro: string;
    staffSource: string;
    staffNote: string;
    staffNoteHint: string;
    staffAcknowledgement: string;
    staffSubmit: string;
    staffPending: string;
    staffReviewRequired: string;
    provenanceGuard: string;
  };
  customer: {
    eyebrow: string;
    listTitle: string;
    listIntro: string;
    emptyTitle: string;
    emptyText: string;
    detailTitle: (reference: string) => string;
    quote: string;
    property: string;
    address: string;
    services: string;
    total: string;
    vat: string;
    duration: string;
    preferredTiming: string;
    confirmedTiming: string;
    created: string;
    terms: string;
    customerNotes: string;
    pendingScheduling: string;
    reviewRequired: string;
    confirmed: string;
    cancelled: string;
  };
  staff: {
    eyebrow: string;
    listTitle: string;
    listIntro: string;
    search: string;
    status: string;
    schedulingStatus: string;
    date: string;
    customer: string;
    assignedTeam: string;
    manualReview: string;
    empty: string;
    pageSummary: (page: number, total: number) => string;
    detailTitle: (reference: string) => string;
    acceptance: string;
    acceptedBy: string;
    acceptedAt: string;
    acceptanceSource: string;
    acceptanceNote: string;
    acceptedQuote: string;
    property: string;
    address: string;
    priceSnapshot: string;
    schedulingSnapshot: string;
    items: string;
    auditTimeline: string;
    internalNotes: string;
    customerNotes: string;
    noTeam: string;
  };
  cancellation: {
    title: string;
    description: string;
    reasonCategory: string;
    reasonText: string;
    reasonHint: string;
    acknowledgement: string;
    submit: string;
    pending: string;
    success: string;
    noChange: string;
    financeDisclaimer: string;
  };
  states: {
    customerLoadingTitle: string;
    customerLoadingText: string;
    customerErrorTitle: string;
    customerErrorText: string;
    staffLoadingTitle: string;
    staffLoadingText: string;
    staffErrorTitle: string;
    staffErrorText: string;
  };
};

const englishLabels = {
  bookingStatuses: {
    PENDING_SCHEDULING: "Pending scheduling",
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
  },
  schedulingStatuses: {
    UNSCHEDULED: "Unscheduled",
    REVIEW_REQUIRED: "Staff review required",
    SCHEDULED: "Scheduled",
  },
  acceptanceActorTypes: {
    CUSTOMER: "Customer",
    STAFF_ON_BEHALF: "Staff on behalf of customer",
  },
  staffAcceptanceSources: {
    PHONE: "Phone",
    EMAIL: "Email",
    IN_PERSON: "In person",
    OTHER_RECORDED: "Other recorded instruction",
  },
  cancellationReasons: {
    CUSTOMER_REQUEST: "Customer request",
    OPERATIONAL: "Operational reason",
    DUPLICATE: "Duplicate booking",
    OTHER: "Other recorded reason",
  },
} satisfies BookingCopy["labels"];

export const bookingContent = {
  bg: {
    common: {
      noValue: "Няма стойност",
      open: "Отвори",
      back: "Назад",
      retry: "Опитайте отново",
      all: "Всички",
      apply: "Приложи",
      clear: "Изчисти",
      unavailable: "Действието временно не е достъпно.",
      invalid: "Проверете въведената информация.",
      conflict: "Записът е променен. Презаредете и опитайте отново.",
    },
    labels: {
      bookingStatuses: {
        PENDING_SCHEDULING: "Очаква насрочване",
        CONFIRMED: "Потвърдена",
        CANCELLED: "Отменена",
      },
      schedulingStatuses: {
        UNSCHEDULED: "Без насрочен час",
        REVIEW_REQUIRED: "Нужен е преглед от екипа",
        SCHEDULED: "Насрочена",
      },
      acceptanceActorTypes: {
        CUSTOMER: "Клиент",
        STAFF_ON_BEHALF: "Служител от името на клиента",
      },
      staffAcceptanceSources: {
        PHONE: "Телефон",
        EMAIL: "Имейл",
        IN_PERSON: "Лично",
        OTHER_RECORDED: "Друг записан начин",
      },
      cancellationReasons: {
        CUSTOMER_REQUEST: "По искане на клиента",
        OPERATIONAL: "Оперативна причина",
        DUPLICATE: "Дублирана резервация",
        OTHER: "Друга записана причина",
      },
    },
    acceptance: {
      customerTitle: "Приемане на офертата",
      customerIntro:
        "Прегледайте точно тази издадена версия, нейните цени, срок и условия, преди да я приемете.",
      acknowledgement:
        "Потвърждавам, че приемам търговските условия на точно тази издадена версия на офертата.",
      scheduleDisclaimer:
        "Приемането изпраща заявка за насрочване. То не потвърждава точен час или наличност.",
      noPaymentDisclaimer:
        "С това действие не се извършва или отчита плащане.",
      submit: "Приеми офертата и заяви насрочване",
      pending: "Приемане на офертата…",
      accepted:
        "Офертата е приета и е създадена резервация, която очаква насрочване.",
      existing:
        "Тази оферта вече е приета. Отворете съществуващата резервация.",
      reviewRequired:
        "Офертата не може да бъде приета автоматично. Екипът трябва да прегледа записите. Не е създадена нова резервация.",
      unavailable:
        "Офертата не може да бъде приета в момента. Презаредете или се свържете с екипа.",
      staffTitle: "Приемане от името на клиента",
      staffIntro:
        "Запишете приемане само след изрично указание от клиента за точно тази издадена оферта.",
      staffSource: "Начин на получаване на указанието",
      staffNote: "Запис на указанието от клиента",
      staffNoteHint:
        "Запишете кога и как клиентът е потвърдил. Не въвеждайте платежни данни или тайни.",
      staffAcknowledgement:
        "Потвърждавам, че клиентът изрично възложи приемането на точно тази издадена оферта.",
      staffSubmit: "Запиши приемане и създай резервация",
      staffPending: "Записване на приемането…",
      staffReviewRequired:
        "Приемането е спряно за преглед. Не е създадена нова резервация и данните не са променяни автоматично.",
      provenanceGuard:
        "При несъответствие в CRM, заявката, нормализацията, оценката, офертата или търговската актуалност спрете за преглед. Не преинтерпретирайте, не нормализирайте отново и не обновявайте мълчаливо изходните данни или условията.",
    },
    customer: {
      eyebrow: "Клиентска зона",
      listTitle: "Моите резервации",
      listIntro:
        "Резервации, създадени от приети оферти за активния ви клиентски профил.",
      emptyTitle: "Все още няма резервации",
      emptyText:
        "Приетите от вас допустими оферти ще се показват тук като отделни резервации.",
      detailTitle: (reference) => `Резервация ${reference}`,
      quote: "Приета оферта",
      property: "Имот",
      address: "Адрес",
      services: "Услуги",
      total: "Общо с ДДС",
      vat: "ДДС",
      duration: "Ориентировъчна продължителност",
      preferredTiming: "Предпочитано време",
      confirmedTiming: "Потвърден час",
      created: "Създадена",
      terms: "Приети условия и допускания",
      customerNotes: "Бележки към офертата",
      pendingScheduling:
        "Търговските условия са приети. Точният час остава непотвърден до преглед на наличността от екипа.",
      reviewRequired:
        "Резервацията изисква преглед от екипа. Няма потвърден точен час.",
      confirmed: "Точният час за тази резервация е потвърден.",
      cancelled:
        "Тази резервация е отменена. Историята на офертата и насрочването е запазена.",
    },
    staff: {
      eyebrow: "Операции и график",
      listTitle: "Резервации",
      listIntro:
        "Преглед на приети оферти, резервации и текущото им състояние за насрочване.",
      search: "Референция на резервация или клиент",
      status: "Статус на резервацията",
      schedulingStatus: "Статус на насрочването",
      date: "Дата",
      customer: "Клиент",
      assignedTeam: "Назначен екип",
      manualReview: "Ръчен преглед",
      empty: "Няма резервации за избраните филтри.",
      pageSummary: (page, total) =>
        `Страница ${page} · ${total} резервации`,
      detailTitle: (reference) => `Резервация ${reference}`,
      acceptance: "Неизменно приемане",
      acceptedBy: "Приета от",
      acceptedAt: "Приета на",
      acceptanceSource: "Източник на приемането",
      acceptanceNote: "Запис на указанието",
      acceptedQuote: "Приета издадена оферта",
      property: "Имот",
      address: "Адрес за посещение",
      priceSnapshot: "Неизменна ценова снимка",
      schedulingSnapshot: "Снимка на насрочването",
      items: "Запазени редове на офертата",
      auditTimeline: "История на събитията",
      internalNotes: "Вътрешни бележки",
      customerNotes: "Бележки, видими за клиента",
      noTeam: "Няма назначен екип",
    },
    cancellation: {
      title: "Отмяна на резервацията",
      description:
        "Отмяната освобождава активното заемане на графика, но запазва офертата, приемането, резервацията и историята на насрочването.",
      reasonCategory: "Категория на причината",
      reasonText: "Допълнителна причина",
      reasonHint:
        "За „Друга записана причина“ е необходимо кратко обяснение. Не въвеждайте платежни данни или тайни.",
      acknowledgement:
        "Разбирам, че отмяната не изтрива историческите записи.",
      submit: "Отмени резервацията",
      pending: "Отмяна…",
      success: "Резервацията е отменена и активното заемане е освободено.",
      noChange: "Резервацията вече е отменена. Не е направена нова промяна.",
      financeDisclaimer:
        "Тук не се изчислява или записва такса за отмяна, възстановяване, плащане или фактура.",
    },
    states: {
      customerLoadingTitle: "Зареждане на вашите резервации…",
      customerLoadingText: "Моля, изчакайте.",
      customerErrorTitle: "Резервациите не можаха да се заредят",
      customerErrorText:
        "Опитайте отново. Ако проблемът продължи, свържете се с екипа.",
      staffLoadingTitle: "Зареждане на резервациите…",
      staffLoadingText: "Моля, изчакайте.",
      staffErrorTitle: "Резервациите не можаха да се заредят",
      staffErrorText:
        "Опитайте отново. Ако проблемът продължи, проверете наблюдението на приложението.",
    },
  },
  en: {
    common: {
      noValue: "Not provided",
      open: "Open",
      back: "Back",
      retry: "Try again",
      all: "All",
      apply: "Apply",
      clear: "Clear",
      unavailable: "This action is temporarily unavailable.",
      invalid: "Check the submitted information.",
      conflict: "The record changed. Refresh and try again.",
    },
    labels: englishLabels,
    acceptance: {
      customerTitle: "Accept this quote",
      customerIntro:
        "Review this exact issued version, its prices, validity, and terms before accepting it.",
      acknowledgement:
        "I confirm that I accept the commercial terms of this exact issued quote.",
      scheduleDisclaimer:
        "Acceptance requests scheduling. It does not confirm an exact appointment or availability.",
      noPaymentDisclaimer:
        "No payment is taken or recorded by this action.",
      submit: "Accept quote and request scheduling",
      pending: "Accepting quote…",
      accepted:
        "The quote was accepted and a booking was created pending scheduling.",
      existing:
        "This quote was already accepted. Open the existing booking.",
      reviewRequired:
        "This quote cannot be accepted automatically; staff must review the records first. No new booking was created.",
      unavailable:
        "The quote cannot be accepted right now. Refresh or contact the team.",
      staffTitle: "Accept on behalf of the customer",
      staffIntro:
        "Record acceptance only after the customer explicitly instructs you to accept this exact issued quote.",
      staffSource: "Instruction source",
      staffNote: "Customer instruction record",
      staffNoteHint:
        "Record when and how the customer confirmed. Do not enter payment data or secrets.",
      staffAcknowledgement:
        "I confirm that the customer explicitly instructed us to accept this exact issued quote.",
      staffSubmit: "Record acceptance and create booking",
      staffPending: "Recording acceptance…",
      staffReviewRequired:
        "Acceptance stopped for staff review. No new booking was created and no record was changed automatically.",
      provenanceGuard:
        "Fail closed to staff review if CRM, request normalization, estimate provenance, quote provenance, or commercial freshness is inconsistent. Do not reinterpret, renormalize, or silently refresh source data or commercial terms.",
    },
    customer: {
      eyebrow: "Customer area",
      listTitle: "My bookings",
      listIntro:
        "Bookings created from accepted quotes for your current active customer link.",
      emptyTitle: "No bookings yet",
      emptyText:
        "Eligible quotes that you accept will appear here as separate bookings.",
      detailTitle: (reference) => `Booking ${reference}`,
      quote: "Accepted quote",
      property: "Property",
      address: "Address",
      services: "Services",
      total: "Total including VAT",
      vat: "VAT",
      duration: "Estimated duration",
      preferredTiming: "Preferred timing",
      confirmedTiming: "Confirmed appointment",
      created: "Created",
      terms: "Accepted terms and assumptions",
      customerNotes: "Quote notes",
      pendingScheduling:
        "The commercial terms are accepted; the exact appointment remains unconfirmed until staff review current availability.",
      reviewRequired:
        "The booking requires staff review. No exact appointment is confirmed.",
      confirmed: "The exact appointment is confirmed for this booking.",
      cancelled:
        "This booking was cancelled. Its quote and scheduling history remain preserved.",
    },
    staff: {
      eyebrow: "Operations and scheduling",
      listTitle: "Bookings",
      listIntro:
        "Review accepted quotes, bookings, and their current scheduling state.",
      search: "Booking reference or customer",
      status: "Booking status",
      schedulingStatus: "Scheduling status",
      date: "Date",
      customer: "Customer",
      assignedTeam: "Assigned team",
      manualReview: "Manual review",
      empty: "No bookings match the selected filters.",
      pageSummary: (page, total) => `Page ${page} · ${total} bookings`,
      detailTitle: (reference) => `Booking ${reference}`,
      acceptance: "Immutable acceptance",
      acceptedBy: "Accepted by",
      acceptedAt: "Accepted",
      acceptanceSource: "Acceptance source",
      acceptanceNote: "Instruction record",
      acceptedQuote: "Accepted issued quote",
      property: "Property",
      address: "Appointment address",
      priceSnapshot: "Immutable price snapshot",
      schedulingSnapshot: "Scheduling snapshot",
      items: "Preserved quote lines",
      auditTimeline: "Event timeline",
      internalNotes: "Staff-only notes",
      customerNotes: "Customer-visible notes",
      noTeam: "No team assigned",
    },
    cancellation: {
      title: "Cancel this booking",
      description:
        "Cancellation releases active schedule occupancy while preserving the quote, acceptance, booking, and scheduling history.",
      reasonCategory: "Reason category",
      reasonText: "Additional reason",
      reasonHint:
        "A short explanation is required for Other. Do not enter payment data or secrets.",
      acknowledgement:
        "I understand that cancellation does not delete historical records.",
      submit: "Cancel booking",
      pending: "Cancelling…",
      success: "The booking was cancelled and active occupancy was released.",
      noChange: "The booking was already cancelled. No new change was made.",
      financeDisclaimer:
        "No cancellation fee, refund, payment, or invoice is calculated or recorded here.",
    },
    states: {
      customerLoadingTitle: "Loading your bookings…",
      customerLoadingText: "Please wait.",
      customerErrorTitle: "Your bookings could not be loaded",
      customerErrorText:
        "Try again. If the problem continues, contact the team.",
      staffLoadingTitle: "Loading bookings…",
      staffLoadingText: "Please wait.",
      staffErrorTitle: "Bookings could not be loaded",
      staffErrorText:
        "Try again. If the problem continues, check application monitoring.",
    },
  },
} as const satisfies Record<AuthLocale, BookingCopy>;

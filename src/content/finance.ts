import type { AuthLocale } from "@/auth/validation";
import type {
  FinanceReviewReasonCode,
  InvoiceDisplayStatus,
  InvoiceEligibilityMode,
  InvoiceType,
  PaymentMethod,
  PaymentStatus,
} from "@/modules/finance-invoicing/types";

export type FinanceCopy = {
  common: {
    all: string;
    apply: string;
    back: string;
    clear: string;
    noValue: string;
    open: string;
    print: string;
    retry: string;
  };
  labels: {
    invoiceStatuses: Record<InvoiceDisplayStatus, string>;
    invoiceTypes: Record<InvoiceType, string>;
    eligibilityModes: Record<InvoiceEligibilityMode, string>;
    paymentMethods: Record<PaymentMethod, string>;
    paymentStatuses: Record<PaymentStatus, string>;
    reviewReasons: Record<FinanceReviewReasonCode, string>;
  };
  staff: {
    eyebrow: string;
    dashboardTitle: string;
    dashboardIntro: string;
    invoicesLink: string;
    listTitle: string;
    listIntro: string;
    search: string;
    status: string;
    empty: string;
    pageSummary: (page: number, total: number) => string;
    detailTitle: (reference: string) => string;
    draftInvoices: string;
    issuedUnpaidInvoices: string;
    partiallyPaidInvoices: string;
    overdueInvoices: string;
    paidInvoices: string;
    unappliedPayments: string;
    invoicedGross: string;
    paid: string;
    outstanding: string;
    overdue: string;
    provenance: string;
    reviewReasons: string;
    internalNote: string;
    eligibility: string;
    relatedJob: string;
    auditTimeline: string;
  };
  customer: {
    eyebrow: string;
    listTitle: string;
    listIntro: string;
    emptyTitle: string;
    emptyText: string;
    detailTitle: (number: string) => string;
    issuedOnlyNotice: string;
  };
  invoice: {
    invoice: string;
    invoiceNumber: string;
    reference: string;
    type: string;
    status: string;
    booking: string;
    quote: string;
    customer: string;
    seller: string;
    issueDate: string;
    dueDate: string;
    created: string;
    items: string;
    description: string;
    quantity: string;
    net: string;
    vatRate: string;
    vat: string;
    gross: string;
    totalNet: string;
    totalVat: string;
    totalGross: string;
    paid: string;
    outstanding: string;
    paymentStatus: string;
    paymentInstructions: string;
    customerNote: string;
    registrationNumber: string;
    vatNumber: string;
    email: string;
    phone: string;
    address: string;
  };
  states: {
    staffLoadingTitle: string;
    staffLoadingText: string;
    staffErrorTitle: string;
    staffErrorText: string;
    customerLoadingTitle: string;
    customerLoadingText: string;
    customerErrorTitle: string;
    customerErrorText: string;
  };
};

export const financeContent = {
  bg: {
    common: {
      all: "Всички",
      apply: "Приложи",
      back: "Назад",
      clear: "Изчисти",
      noValue: "Няма стойност",
      open: "Отвори",
      print: "Печат",
      retry: "Опитайте отново",
    },
    labels: {
      invoiceStatuses: {
        DRAFT: "Чернова",
        READY_TO_ISSUE: "Готова за издаване",
        ISSUED: "Издадена",
        PARTIALLY_PAID: "Частично платена",
        PAID: "Платена",
        CANCELLED: "Отменена",
        OVERDUE: "Просрочена",
      },
      invoiceTypes: {
        STANDARD: "Фактура",
        PROFORMA: "Проформа",
      },
      eligibilityModes: {
        BOOKING_ACCEPTED: "Приета резервация",
        JOB_COMPLETION_REQUIRED: "Изисква завършена работа",
      },
      paymentMethods: {
        BANK_TRANSFER: "Банков превод",
        CASH: "В брой",
        CARD_MANUAL_REFERENCE: "Карта — ръчно записана референция",
        OTHER: "Друг метод",
      },
      paymentStatuses: {
        RECORDED: "Записано",
        CONFIRMED: "Потвърдено",
        REVERSED: "Сторнирано",
      },
      reviewReasons: {
        COMMERCIAL_PROVENANCE_INCOMPLETE: "Непълна търговска проследимост",
        COMMERCIAL_TOTALS_INCONSISTENT: "Несъответствие в търговските суми",
        CUSTOMER_BILLING_PROFILE_MISSING: "Липсва профил за фактуриране на клиента",
        CUSTOMER_BILLING_PROFILE_UNAPPROVED: "Профилът за фактуриране не е одобрен",
        SELLER_LEGAL_PROFILE_MISSING: "Липсва правен профил на доставчика",
        SELLER_LEGAL_PROFILE_UNAPPROVED: "Правният профил на доставчика не е одобрен",
        VAT_STATE_UNRESOLVED: "ДДС режимът не е изяснен",
        INVOICE_POLICY_MISSING: "Липсва одобрена политика за фактуриране",
        NUMBERING_POLICY_MISSING: "Липсва одобрена политика за номерация",
        JOB_COMPLETION_REQUIRED: "Изисква се завършване на работата",
        JOB_SCOPE_DIFFERENCE: "Разлика между договорения и изпълнения обхват",
        MANUAL_ADJUSTMENT_REQUESTED: "Поискана е ръчна корекция",
      },
    },
    staff: {
      eyebrow: "Финанси",
      dashboardTitle: "Финансов преглед",
      dashboardIntro:
        "Обобщение на фактурите и плащанията. Сумите се четат от записаните финансови факти и не преизчисляват приетата оферта.",
      invoicesLink: "Всички фактури",
      listTitle: "Фактури",
      listIntro:
        "Търсене и преглед на чернови, издадени и уредени фактури.",
      search: "Търсене",
      status: "Статус",
      empty: "Няма фактури, които отговарят на избраните условия.",
      pageSummary: (page, total) => `Страница ${page} · ${total} общо`,
      detailTitle: (reference) => `Фактура ${reference}`,
      draftInvoices: "Чернови",
      issuedUnpaidInvoices: "Издадени и неплатени",
      partiallyPaidInvoices: "Частично платени",
      overdueInvoices: "Просрочени",
      paidInvoices: "Платени",
      unappliedPayments: "Неразпределени плащания",
      invoicedGross: "Фактурирано общо",
      paid: "Платено",
      outstanding: "Непогасено",
      overdue: "Просрочено",
      provenance: "Проследимост",
      reviewReasons: "Причини за финансов преглед",
      internalNote: "Вътрешна бележка",
      eligibility: "Основание за фактуриране",
      relatedJob: "Свързана работа",
      auditTimeline: "Одитна хронология",
    },
    customer: {
      eyebrow: "Клиентска зона",
      listTitle: "Моите фактури",
      listIntro:
        "Издадени фактури за активния ви клиентски профил.",
      emptyTitle: "Все още няма издадени фактури",
      emptyText:
        "Когато бъде издадена фактура за вашия активен клиентски профил, тя ще се появи тук.",
      detailTitle: (number) => `Фактура ${number}`,
      issuedOnlyNotice:
        "Клиентската зона показва само издадени документи, свързани точно с активния ви клиентски профил.",
    },
    invoice: {
      invoice: "Фактура",
      invoiceNumber: "Номер",
      reference: "Референция",
      type: "Вид",
      status: "Статус",
      booking: "Резервация",
      quote: "Оферта",
      customer: "Получател",
      seller: "Доставчик",
      issueDate: "Дата на издаване",
      dueDate: "Срок за плащане",
      created: "Създадена",
      items: "Позиции",
      description: "Описание",
      quantity: "Количество",
      net: "Нетна стойност",
      vatRate: "ДДС ставка",
      vat: "ДДС",
      gross: "Общо",
      totalNet: "Общо без ДДС",
      totalVat: "Общо ДДС",
      totalGross: "Общо с ДДС",
      paid: "Платено",
      outstanding: "Непогасено",
      paymentStatus: "Статус на плащане",
      paymentInstructions: "Указания за плащане",
      customerNote: "Бележка към клиента",
      registrationNumber: "ЕИК / регистрационен номер",
      vatNumber: "ДДС номер",
      email: "Имейл",
      phone: "Телефон",
      address: "Адрес",
    },
    states: {
      staffLoadingTitle: "Зареждане на финансовите записи…",
      staffLoadingText: "Моля, изчакайте.",
      staffErrorTitle: "Финансовите записи не можаха да се заредят",
      staffErrorText:
        "Опитайте отново. Ако проблемът продължи, проверете наблюдението.",
      customerLoadingTitle: "Зареждане на вашите фактури…",
      customerLoadingText: "Моля, изчакайте.",
      customerErrorTitle: "Фактурите не можаха да се заредят",
      customerErrorText:
        "Опитайте отново. Ако проблемът продължи, свържете се с екипа.",
    },
  },
  en: {
    common: {
      all: "All",
      apply: "Apply",
      back: "Back",
      clear: "Clear",
      noValue: "Not available",
      open: "Open",
      print: "Print",
      retry: "Try again",
    },
    labels: {
      invoiceStatuses: {
        DRAFT: "Draft",
        READY_TO_ISSUE: "Ready to issue",
        ISSUED: "Issued",
        PARTIALLY_PAID: "Partially paid",
        PAID: "Paid",
        CANCELLED: "Cancelled",
        OVERDUE: "Overdue",
      },
      invoiceTypes: {
        STANDARD: "Invoice",
        PROFORMA: "Pro forma",
      },
      eligibilityModes: {
        BOOKING_ACCEPTED: "Accepted booking",
        JOB_COMPLETION_REQUIRED: "Completed job required",
      },
      paymentMethods: {
        BANK_TRANSFER: "Bank transfer",
        CASH: "Cash",
        CARD_MANUAL_REFERENCE: "Card — manually recorded reference",
        OTHER: "Other method",
      },
      paymentStatuses: {
        RECORDED: "Recorded",
        CONFIRMED: "Confirmed",
        REVERSED: "Reversed",
      },
      reviewReasons: {
        COMMERCIAL_PROVENANCE_INCOMPLETE: "Commercial provenance is incomplete",
        COMMERCIAL_TOTALS_INCONSISTENT: "Commercial totals are inconsistent",
        CUSTOMER_BILLING_PROFILE_MISSING: "Customer billing profile is missing",
        CUSTOMER_BILLING_PROFILE_UNAPPROVED: "Customer billing profile is not approved",
        SELLER_LEGAL_PROFILE_MISSING: "Seller legal profile is missing",
        SELLER_LEGAL_PROFILE_UNAPPROVED: "Seller legal profile is not approved",
        VAT_STATE_UNRESOLVED: "VAT state is unresolved",
        INVOICE_POLICY_MISSING: "Approved invoice policy is missing",
        NUMBERING_POLICY_MISSING: "Approved numbering policy is missing",
        JOB_COMPLETION_REQUIRED: "Job completion is required",
        JOB_SCOPE_DIFFERENCE: "Delivered scope differs from accepted scope",
        MANUAL_ADJUSTMENT_REQUESTED: "A manual adjustment was requested",
      },
    },
    staff: {
      eyebrow: "Finance",
      dashboardTitle: "Finance overview",
      dashboardIntro:
        "Invoice and payment summary. Amounts come from recorded finance facts and do not reprice the accepted quote.",
      invoicesLink: "All invoices",
      listTitle: "Invoices",
      listIntro: "Search and review draft, issued, and settled invoices.",
      search: "Search",
      status: "Status",
      empty: "No invoices match the selected filters.",
      pageSummary: (page, total) => `Page ${page} · ${total} total`,
      detailTitle: (reference) => `Invoice ${reference}`,
      draftInvoices: "Drafts",
      issuedUnpaidInvoices: "Issued and unpaid",
      partiallyPaidInvoices: "Partially paid",
      overdueInvoices: "Overdue",
      paidInvoices: "Paid",
      unappliedPayments: "Unapplied payments",
      invoicedGross: "Gross invoiced",
      paid: "Paid",
      outstanding: "Outstanding",
      overdue: "Overdue",
      provenance: "Provenance",
      reviewReasons: "Finance review reasons",
      internalNote: "Internal note",
      eligibility: "Invoice eligibility",
      relatedJob: "Related job",
      auditTimeline: "Audit timeline",
    },
    customer: {
      eyebrow: "Customer area",
      listTitle: "My invoices",
      listIntro: "Issued invoices for your active customer profile.",
      emptyTitle: "No issued invoices yet",
      emptyText:
        "When an invoice is issued for your active customer profile, it will appear here.",
      detailTitle: (number) => `Invoice ${number}`,
      issuedOnlyNotice:
        "The customer area shows only issued documents linked exactly to your active customer profile.",
    },
    invoice: {
      invoice: "Invoice",
      invoiceNumber: "Number",
      reference: "Reference",
      type: "Type",
      status: "Status",
      booking: "Booking",
      quote: "Quote",
      customer: "Customer",
      seller: "Seller",
      issueDate: "Issue date",
      dueDate: "Due date",
      created: "Created",
      items: "Line items",
      description: "Description",
      quantity: "Quantity",
      net: "Net amount",
      vatRate: "VAT rate",
      vat: "VAT",
      gross: "Total",
      totalNet: "Total excluding VAT",
      totalVat: "Total VAT",
      totalGross: "Total including VAT",
      paid: "Paid",
      outstanding: "Outstanding",
      paymentStatus: "Payment status",
      paymentInstructions: "Payment instructions",
      customerNote: "Customer note",
      registrationNumber: "Registration number",
      vatNumber: "VAT number",
      email: "Email",
      phone: "Phone",
      address: "Address",
    },
    states: {
      staffLoadingTitle: "Loading finance records…",
      staffLoadingText: "Please wait.",
      staffErrorTitle: "Finance records could not be loaded",
      staffErrorText:
        "Try again. If the problem continues, check monitoring.",
      customerLoadingTitle: "Loading your invoices…",
      customerLoadingText: "Please wait.",
      customerErrorTitle: "Your invoices could not be loaded",
      customerErrorText:
        "Try again. If the problem continues, contact the team.",
    },
  },
} satisfies Record<AuthLocale, FinanceCopy>;

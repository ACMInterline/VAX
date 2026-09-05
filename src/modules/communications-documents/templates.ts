import type {
  CanonicalCommunicationTemplate,
  CommunicationDocumentType,
  CommunicationEventType,
} from "./types";

type TemplatePair = Readonly<{
  templateKey: string;
  documentType: CommunicationDocumentType;
  variables: readonly string[];
  bg: Readonly<{ title: string; body: string }>;
  en: Readonly<{ title: string; body: string }>;
}>;

const templatePairs: readonly TemplatePair[] = [
  {
    templateKey: "quote_issued",
    documentType: "QUOTE_SUMMARY",
    variables: ["customer_name", "quote_reference", "valid_until", "gross_total"],
    bg: {
      title: "Оферта {{quote_reference}}",
      body: "Здравейте, {{customer_name}}. Офертата е валидна до {{valid_until}} и е на обща стойност {{gross_total}}.",
    },
    en: {
      title: "Quote {{quote_reference}}",
      body: "Hello {{customer_name}}. This quote is valid until {{valid_until}} and totals {{gross_total}}.",
    },
  },
  {
    templateKey: "booking_confirmed",
    documentType: "BOOKING_CONFIRMATION",
    variables: ["customer_name", "booking_reference", "schedule"],
    bg: {
      title: "Потвърдена резервация {{booking_reference}}",
      body: "Здравейте, {{customer_name}}. Потвърденият час за услугата е {{schedule}}.",
    },
    en: {
      title: "Booking confirmed {{booking_reference}}",
      body: "Hello {{customer_name}}. The confirmed service time is {{schedule}}.",
    },
  },
  {
    templateKey: "booking_rescheduled",
    documentType: "BOOKING_CONFIRMATION",
    variables: ["customer_name", "booking_reference", "schedule"],
    bg: {
      title: "Променен час за {{booking_reference}}",
      body: "Здравейте, {{customer_name}}. Новият потвърден час за услугата е {{schedule}}.",
    },
    en: {
      title: "Booking rescheduled {{booking_reference}}",
      body: "Hello {{customer_name}}. The new confirmed service time is {{schedule}}.",
    },
  },
  {
    templateKey: "booking_cancelled",
    documentType: "BOOKING_CONFIRMATION",
    variables: ["customer_name", "booking_reference", "event_date"],
    bg: {
      title: "Отменена резервация {{booking_reference}}",
      body: "Здравейте, {{customer_name}}. Резервацията е отбелязана като отменена на {{event_date}}.",
    },
    en: {
      title: "Booking cancelled {{booking_reference}}",
      body: "Hello {{customer_name}}. The booking was recorded as cancelled on {{event_date}}.",
    },
  },
  {
    templateKey: "job_completed",
    documentType: "JOB_COMPLETION_SUMMARY",
    variables: ["customer_name", "job_reference", "completed_at"],
    bg: {
      title: "Завършена услуга {{job_reference}}",
      body: "Здравейте, {{customer_name}}. Работата е завършена на {{completed_at}}.",
    },
    en: {
      title: "Service completed {{job_reference}}",
      body: "Hello {{customer_name}}. The work was completed on {{completed_at}}.",
    },
  },
  {
    templateKey: "cleaning_passport_ready",
    documentType: "CLEANING_PASSPORT",
    variables: ["customer_name", "job_reference", "completed_at"],
    bg: {
      title: "Паспорт на почистването {{job_reference}}",
      body: "Здравейте, {{customer_name}}. Паспортът съдържа потвърдените резултати от работата, завършена на {{completed_at}}.",
    },
    en: {
      title: "Cleaning Passport {{job_reference}}",
      body: "Hello {{customer_name}}. This passport contains the confirmed results of the work completed on {{completed_at}}.",
    },
  },
  {
    templateKey: "invoice_issued",
    documentType: "INVOICE",
    variables: ["customer_name", "invoice_number", "due_date", "gross_total"],
    bg: {
      title: "Фактура {{invoice_number}}",
      body: "Здравейте, {{customer_name}}. Фактурата е на стойност {{gross_total}} със срок за плащане {{due_date}}.",
    },
    en: {
      title: "Invoice {{invoice_number}}",
      body: "Hello {{customer_name}}. The invoice totals {{gross_total}} and is due on {{due_date}}.",
    },
  },
  {
    templateKey: "payment_confirmed",
    documentType: "PAYMENT_ACKNOWLEDGEMENT",
    variables: ["payment_reference", "amount", "confirmed_at"],
    bg: {
      title: "Потвърдено плащане {{payment_reference}}",
      body: "Плащането на стойност {{amount}} е потвърдено във VAX на {{confirmed_at}}. Това не е доказателство за доставка от външен платежен доставчик.",
    },
    en: {
      title: "Payment confirmed {{payment_reference}}",
      body: "The payment of {{amount}} was confirmed in VAX on {{confirmed_at}}. This is not evidence of delivery by an external payment provider.",
    },
  },
  {
    templateKey: "payment_reversed",
    documentType: "PAYMENT_ACKNOWLEDGEMENT",
    variables: ["payment_reference", "amount", "reversed_at"],
    bg: {
      title: "Сторнирано плащане {{payment_reference}}",
      body: "Записът за плащане на стойност {{amount}} е сторниран във VAX на {{reversed_at}}. Това не представлява автоматично връщане на средства.",
    },
    en: {
      title: "Payment reversed {{payment_reference}}",
      body: "The VAX payment record for {{amount}} was reversed on {{reversed_at}}. This does not represent an automatic refund.",
    },
  },
  // Prospective customer-facing identities. The original payment template
  // bytes above remain canonical for referenced historical documents.
  {
    templateKey: "attelier_payment_confirmed",
    documentType: "PAYMENT_ACKNOWLEDGEMENT",
    variables: ["payment_reference", "amount", "confirmed_at"],
    bg: {
      title: "Потвърдено плащане {{payment_reference}}",
      body: "Плащането на стойност {{amount}} е потвърдено в ATTELIER на {{confirmed_at}}. Това не е доказателство за доставка от външен платежен доставчик.",
    },
    en: {
      title: "Payment confirmed {{payment_reference}}",
      body: "The payment of {{amount}} was confirmed in ATTELIER on {{confirmed_at}}. This is not evidence of delivery by an external payment provider.",
    },
  },
  {
    templateKey: "attelier_payment_reversed",
    documentType: "PAYMENT_ACKNOWLEDGEMENT",
    variables: ["payment_reference", "amount", "reversed_at"],
    bg: {
      title: "Сторнирано плащане {{payment_reference}}",
      body: "Записът за плащане на стойност {{amount}} е сторниран в ATTELIER на {{reversed_at}}. Това не представлява автоматично връщане на средства.",
    },
    en: {
      title: "Payment reversed {{payment_reference}}",
      body: "The ATTELIER payment record for {{amount}} was reversed on {{reversed_at}}. This does not represent an automatic refund.",
    },
  },
];

export const canonicalCommunicationTemplates = templatePairs.flatMap(
  (template): readonly CanonicalCommunicationTemplate[] => [
    {
      templateKey: template.templateKey,
      version: 1,
      locale: "bg",
      documentType: template.documentType,
      titleTemplate: template.bg.title,
      bodyTemplate: template.bg.body,
      variablesContract: template.variables,
    },
    {
      templateKey: template.templateKey,
      version: 1,
      locale: "en",
      documentType: template.documentType,
      titleTemplate: template.en.title,
      bodyTemplate: template.en.body,
      variablesContract: template.variables,
    },
  ],
);

export function templateKeyFor(
  eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">,
  documentType: CommunicationDocumentType,
): string {
  if (eventType === "JOB_COMPLETED" && documentType === "CLEANING_PASSPORT") {
    return "cleaning_passport_ready";
  }
  const mapping: Record<
    Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">,
    string
  > = {
    QUOTE_ISSUED: "quote_issued",
    BOOKING_CONFIRMED: "booking_confirmed",
    BOOKING_RESCHEDULED: "booking_rescheduled",
    BOOKING_CANCELLED: "booking_cancelled",
    JOB_COMPLETED: "job_completed",
    INVOICE_ISSUED: "invoice_issued",
    PAYMENT_CONFIRMED: "attelier_payment_confirmed",
    PAYMENT_REVERSED: "attelier_payment_reversed",
  };
  return mapping[eventType];
}

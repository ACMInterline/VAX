import type {
  CommunicationChannel,
  CommunicationDocumentType,
  CommunicationEventType,
  CommunicationIntentStatus,
} from "@/modules/communications-documents/types";

const labels = {
  bg: {
    events: {
      QUOTE_ISSUED: "Издадена оферта",
      BOOKING_CONFIRMED: "Потвърдена резервация",
      BOOKING_RESCHEDULED: "Променен график",
      BOOKING_CANCELLED: "Отменена резервация",
      JOB_COMPLETED: "Завършена работа",
      INVOICE_ISSUED: "Издадена фактура",
      PAYMENT_CONFIRMED: "Потвърдено плащане",
      PAYMENT_REVERSED: "Сторнирано плащане",
      MANUAL_STAFF_MESSAGE: "Ръчно съобщение",
    },
    documents: {
      QUOTE_SUMMARY: "Оферта",
      BOOKING_CONFIRMATION: "Потвърждение за резервация",
      JOB_COMPLETION_SUMMARY: "Обобщение на работата",
      CLEANING_PASSPORT: "Паспорт на почистването",
      INVOICE: "Фактура",
      PAYMENT_ACKNOWLEDGEMENT: "Потвърждение за плащане",
    },
    statuses: {
      DRAFT: "Чернова",
      READY: "Готово",
      QUEUED_FUTURE: "Отложен бъдещ канал",
      DELIVERED_LOCAL: "Публикувано в портала",
      FAILED: "Неуспешно",
      CANCELLED: "Отменено",
    },
    channels: {
      PORTAL: "VAX портал",
      EMAIL_FUTURE: "Имейл — бъдещ адаптер",
      SMS_FUTURE: "SMS — бъдещ адаптер",
      MANUAL: "Ръчно доказателство",
    },
  },
  en: {
    events: {
      QUOTE_ISSUED: "Quote issued",
      BOOKING_CONFIRMED: "Booking confirmed",
      BOOKING_RESCHEDULED: "Booking rescheduled",
      BOOKING_CANCELLED: "Booking cancelled",
      JOB_COMPLETED: "Job completed",
      INVOICE_ISSUED: "Invoice issued",
      PAYMENT_CONFIRMED: "Payment confirmed",
      PAYMENT_REVERSED: "Payment reversed",
      MANUAL_STAFF_MESSAGE: "Manual staff message",
    },
    documents: {
      QUOTE_SUMMARY: "Quote",
      BOOKING_CONFIRMATION: "Booking confirmation",
      JOB_COMPLETION_SUMMARY: "Job completion summary",
      CLEANING_PASSPORT: "Cleaning Passport",
      INVOICE: "Invoice",
      PAYMENT_ACKNOWLEDGEMENT: "Payment acknowledgement",
    },
    statuses: {
      DRAFT: "Draft",
      READY: "Ready",
      QUEUED_FUTURE: "Deferred future channel",
      DELIVERED_LOCAL: "Published in the portal",
      FAILED: "Failed",
      CANCELLED: "Cancelled",
    },
    channels: {
      PORTAL: "VAX portal",
      EMAIL_FUTURE: "Email — future adapter",
      SMS_FUTURE: "SMS — future adapter",
      MANUAL: "Manual evidence",
    },
  },
} satisfies Record<
  "bg" | "en",
  {
    events: Record<CommunicationEventType, string>;
    documents: Record<CommunicationDocumentType, string>;
    statuses: Record<CommunicationIntentStatus, string>;
    channels: Record<CommunicationChannel, string>;
  }
>;

export const communicationsContent = {
  bg: {
    ...labels.bg,
    common: {
      back: "Назад",
      open: "Отвори",
      save: "Запази",
      create: "Създай и публикувай",
      print: "Печат / запазване като PDF",
      noValue: "Няма",
      reference: "Референция",
      source: "Източник",
      created: "Създадено",
      locale: "Език",
      status: "Статус",
      channel: "Канал",
    },
    staff: {
      eyebrow: "Контролирани комуникации",
      title: "Комуникации и документи",
      intro:
        "Създавайте неизменим клиентски документ само от допустимо, вече записано бизнес събитие.",
      createTitle: "Публикуване в клиентския портал",
      event: "Бизнес събитие",
      documentType: "Тип документ",
      sourceReference: "Референция на източника",
      portalOnly:
        "Тази форма публикува само във VAX портала. Не изпраща имейл, SMS или друго външно съобщение.",
      empty: "Няма създадени комуникации.",
      created: "Документът е финализиран и публикуван в портала.",
      existing: "За това събитие вече има същия публикуван документ.",
      detailTitle: "Комуникация",
      contactSelected: "Избран контакт",
      template: "Шаблон",
      checksum: "Контролна сума",
    },
    customer: {
      eyebrow: "Моят защитен архив",
      title: "Моите комуникации и документи",
      intro:
        "Тук се виждат само финализирани документи, публикувани за свързания с профила ви клиент.",
      emptyTitle: "Все още няма публикувани документи",
      emptyText: "Новите документи ще се появят тук след публикуване от екипа.",
      preferencesTitle: "Предпочитания за комуникация",
      portalEnabled: "Документи в портала",
      emailFutureEnabled: "Разреши бъдещ имейл канал",
      smsFutureEnabled: "Разреши бъдещ SMS канал",
      operationalAllowed: "Оперативни съобщения",
      billingAllowed: "Финансови съобщения",
      marketingConsent: "Маркетингово съгласие (отделно; без автоматизация)",
      preferredLocale: "Предпочитан език",
      saved: "Предпочитанията са запазени.",
      documentNotice:
        "Това е неизменим архивен изглед. Печатът се генерира от запазения документ, а не от текущи CRM данни.",
    },
    errors: {
      invalid: "Проверете полетата и опитайте отново.",
      denied: "Нямате достъп до тази операция.",
      limited: "Твърде много опити. Изчакайте и опитайте отново.",
      unavailable: "Операцията не може да бъде завършена в момента.",
      conflict: "Записът е променен. Презаредете и опитайте отново.",
      review:
        "Източникът или произходът не е достатъчно надежден. Необходим е преглед от екипа.",
      preference: "Настройките на клиента не позволяват тази комуникация.",
    },
  },
  en: {
    ...labels.en,
    common: {
      back: "Back",
      open: "Open",
      save: "Save",
      create: "Create and publish",
      print: "Print / save as PDF",
      noValue: "None",
      reference: "Reference",
      source: "Source",
      created: "Created",
      locale: "Language",
      status: "Status",
      channel: "Channel",
    },
    staff: {
      eyebrow: "Controlled communications",
      title: "Communications and documents",
      intro:
        "Create an immutable customer document only from an eligible, already-recorded business event.",
      createTitle: "Publish to the customer portal",
      event: "Business event",
      documentType: "Document type",
      sourceReference: "Source reference",
      portalOnly:
        "This form publishes only in the VAX portal. It does not send email, SMS, or any other external message.",
      empty: "No communications have been created.",
      created: "The document was finalized and published in the portal.",
      existing: "The same published document already exists for this event.",
      detailTitle: "Communication",
      contactSelected: "Contact selected",
      template: "Template",
      checksum: "Checksum",
    },
    customer: {
      eyebrow: "My protected archive",
      title: "My communications and documents",
      intro:
        "Only finalized documents published for the customer explicitly linked to your profile appear here.",
      emptyTitle: "No documents have been published yet",
      emptyText: "New documents will appear here after staff publication.",
      preferencesTitle: "Communication preferences",
      portalEnabled: "Portal documents",
      emailFutureEnabled: "Allow a future email channel",
      smsFutureEnabled: "Allow a future SMS channel",
      operationalAllowed: "Operational communications",
      billingAllowed: "Billing communications",
      marketingConsent: "Marketing consent (separate; no automation)",
      preferredLocale: "Preferred language",
      saved: "Preferences were saved.",
      documentNotice:
        "This is an immutable archive view. Printing uses the stored document, not current CRM data.",
    },
    errors: {
      invalid: "Check the fields and try again.",
      denied: "You do not have access to this operation.",
      limited: "Too many attempts. Wait and try again.",
      unavailable: "The operation cannot be completed right now.",
      conflict: "The record changed. Reload and try again.",
      review:
        "The source or provenance is not reliable enough. Staff review is required.",
      preference: "The customer preferences do not allow this communication.",
    },
  },
} as const;

export type CommunicationsCopy =
  (typeof communicationsContent)[keyof typeof communicationsContent];

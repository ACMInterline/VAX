import type { AuthLocale } from "@/auth/validation";
import {
  schedulingReadinessCodes,
  schedulingReasonCategories,
  type SchedulingReadinessCode,
  type SchedulingReasonCategory,
} from "@/modules/scheduling-dispatch/types";

export { schedulingReadinessCodes, schedulingReasonCategories };
export type { SchedulingReadinessCode, SchedulingReasonCategory };

type SchedulingContent = Readonly<{
  common: Readonly<{
    noValue: string;
    open: string;
    back: string;
    retry: string;
    minutes: (value: number) => string;
    date: (value: string) => string;
    dateTime: (value: Date) => string;
  }>;
  dispatch: Readonly<{
    eyebrow: string;
    title: string;
    intro: string;
    previousDay: string;
    today: string;
    nextDay: string;
    chooseDate: string;
    openDate: string;
    unscheduledTitle: string;
    unscheduledEmpty: string;
    teamsTitle: string;
    teamEmpty: string;
    preferredTiming: string;
    bookingReference: string;
    bookingStatus: string;
    jobReference: string;
    jobStatus: string;
    jobNotPrepared: string;
    area: string;
    duration: string;
    readiness: string;
    equipment: string;
    serviceTime: string;
    travel: string;
    buffer: string;
    metricsTitle: string;
    scheduledJobs: string;
    serviceMinutes: string;
    travelMinutes: string;
    bufferMinutes: string;
    idleMinutes: string;
    utilization: string;
    occupiedTeamHours: string;
    laborHours: string;
    revenuePerOccupiedTeamHour: string;
    provisionalTitle: string;
    provisionalText: string;
    fallbackTravel: string;
  }>;
  booking: Readonly<{
    eyebrow: string;
    title: (reference: string) => string;
    intro: string;
    currentAppointment: string;
    noAppointment: string;
    candidatesTitle: string;
    candidatesEmpty: string;
    candidateRank: (rank: number) => string;
    selectCandidate: string;
    reasonCategory: string;
    reasonText: string;
    reasonHint: string;
    acknowledgement: string;
    confirmationTitle: string;
    confirmationDescription: string;
    confirmationCancel: string;
    scheduleSubmit: string;
    rescheduleSubmit: string;
    pending: string;
    invalid: string;
    safeError: string;
    denied: string;
    limited: string;
    conflict: string;
    reviewRequired: string;
    scheduled: string;
    rescheduled: string;
    noChange: string;
    exactEndNotice: string;
  }>;
  today: Readonly<{
    eyebrow: string;
    title: string;
    intro: string;
    back: string;
  }>;
  readiness: Readonly<Record<SchedulingReadinessCode, string>>;
  reasons: Readonly<Record<SchedulingReasonCategory, string>>;
  states: Readonly<{
    loadingTitle: string;
    loadingText: string;
    errorTitle: string;
    errorText: string;
  }>;
}>;

function dateTime(locale: AuthLocale, value: Date): string {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(value);
}

function date(locale: AuthLocale, value: string): string {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "long",
    timeZone: "Europe/Sofia",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

const warningMessages = {
  SCHEDULING_CONFIGURATION_INCOMPLETE: {
    bg: "Оперативната конфигурация е непълна и изисква служебен преглед.",
    en: "Operational configuration is incomplete and requires staff review.",
  },
  SCHEDULING_CONFIGURATION_DRAFT: {
    bg: "Използва се DRAFT оперативна конфигурация за преглед.",
    en: "DRAFT operational configuration is being used for review.",
  },
  JOB_NOT_PREPARED: {
    bg: "За посещението все още няма подготвена работна задача.",
    en: "No prepared field job exists for this visit yet.",
  },
  JOB_TEAM_BINDING_REQUIRED: {
    bg: "Работната задача изисква преглед на връзката с назначения екип.",
    en: "The field job requires review of its assigned-team binding.",
  },
  CURRENT_OPERATIONAL_REQUIREMENTS_INVALID: {
    bg: "Текущите оперативни изисквания са невалидни и изискват служебен преглед.",
    en: "Current operational requirements are invalid and require staff review.",
  },
  CURRENT_SERVICE_LOCATION_INVALID: {
    bg: "Текущият адрес за услугата е непълен и изисква служебен преглед.",
    en: "The current service location is incomplete and requires staff review.",
  },
  CURRENT_TEAM_UNAVAILABLE: {
    bg: "Назначеният екип вече не е наличен.",
    en: "The assigned team is no longer available.",
  },
  CURRENT_WORKING_HOURS_UNAVAILABLE: {
    bg: "Текущото работно време вече не покрива посещението.",
    en: "Current working hours no longer cover the appointment.",
  },
  CURRENT_EQUIPMENT_ASSIGNMENT_INVALID: {
    bg: "Текущото оборудване или назначението му към екипа вече не е валидно за посещението.",
    en: "The current equipment or its team assignment is no longer valid for the appointment.",
  },
  CURRENT_SCHEDULE_EVIDENCE_INVALID: {
    bg: "Текущите данни за графика не могат да бъдат потвърдени безопасно.",
    en: "The current schedule evidence cannot be validated safely.",
  },
  CURRENT_TRAVEL_OR_BUFFER_CHANGED: {
    bg: "Текущото пътуване или оперативният буфер вече не съвпада с потвърдения интервал.",
    en: "Current travel or buffer assumptions no longer match the confirmed interval.",
  },
  CURRENT_JOB_REVIEW_REQUIRED: {
    bg: "Работната задача изисква служебен преглед.",
    en: "The field job requires staff review.",
  },
  STAFF_SCHEDULING_REVIEW_REQUIRED: {
    bg: "Резервацията изисква служебен преглед преди насрочване.",
    en: "The booking requires staff review before scheduling.",
  },
  BOOKING_CANCELLED: {
    bg: "Отменена резервация не може да бъде насрочена.",
    en: "A cancelled booking cannot be scheduled.",
  },
  BOOKING_STATE_REVIEW_REQUIRED: {
    bg: "Състоянието на резервацията изисква служебен преглед.",
    en: "The booking state requires staff review.",
  },
  DURATION_PROVENANCE_INCOMPLETE: {
    bg: "Неизменният произход на продължителността е непълен.",
    en: "Immutable duration provenance is incomplete.",
  },
  ACCEPTANCE_PROVENANCE_INCOMPLETE: {
    bg: "Произходът на приемането и издадената оферта е непълен.",
    en: "Acceptance and issued-quote provenance is incomplete.",
  },
  CRM_OWNERSHIP_REVIEW_REQUIRED: {
    bg: "Връзката клиент–имот изисква служебен преглед.",
    en: "The customer-property relationship requires staff review.",
  },
  OPERATIONAL_REQUIREMENTS_UNKNOWN: {
    bg: "Оперативните изисквания не са достатъчно определени.",
    en: "Operational requirements are not sufficiently defined.",
  },
  IMMUTABLE_LOCATION_INCOMPLETE: {
    bg: "Неизменните данни за адреса са непълни.",
    en: "Immutable service-location evidence is incomplete.",
  },
  JOB_PROVENANCE_REVIEW_REQUIRED: {
    bg: "Съществуващата работна задача изисква преглед преди промяна.",
    en: "The existing field job requires review before a schedule change.",
  },
  SERVICE_AREA_OR_WINDOW_REVIEW_REQUIRED: {
    bg: "Зоната или предпочитаният часови прозорец изисква преглед.",
    en: "The service area or preferred window requires review.",
  },
  NO_FEASIBLE_CANDIDATE: {
    bg: "Не е намерен безопасен кандидат за избраната дата.",
    en: "No safe candidate was found for the selected date.",
  },
  "Travel requires manual route review.": {
    bg: "Пътуването изисква ръчен преглед на маршрута.",
    en: "Travel requires manual route review.",
  },
  "The preceding appointment has no usable location.": {
    bg: "Предходното посещение няма използваем адрес за пътуване.",
    en: "The preceding appointment has no usable travel location.",
  },
  "The following appointment has no usable location.": {
    bg: "Следващото посещение няма използваем адрес за пътуване.",
    en: "The following appointment has no usable travel location.",
  },
  "Outside provisional working hours.": {
    bg: "Кандидатът е извън временните работни часове.",
    en: "The candidate is outside provisional working hours.",
  },
  "Operational occupancy conflicts with another appointment.": {
    bg: "Оперативният интервал се застъпва с друго посещение.",
    en: "The operational interval conflicts with another appointment.",
  },
  "Required equipment conflicts with another appointment.": {
    bg: "Необходимото оборудване се застъпва с друго посещение.",
    en: "Required equipment conflicts with another appointment.",
  },
  "Draft scheduling configuration requires explicit staff review.": {
    bg: "DRAFT конфигурацията изисква изричен служебен преглед.",
    en: "DRAFT scheduling configuration requires explicit staff review.",
  },
  "Deterministic travel fallback was used; no live routing provider was called.": {
    bg: "Използвана е детерминистична резервна оценка без доставчик на маршрут в реално време.",
    en: "A deterministic travel fallback was used without a live routing provider.",
  },
  "Deterministic development travel assumption; no live routing provider was called.": {
    bg: "Използвано е тестово допускане за пътуване без доставчик на маршрут в реално време.",
    en: "A development travel assumption was used without a live routing provider.",
  },
  "Default development travel fallback; no matching matrix rule or live route was available.": {
    bg: "Използвана е тестова резервна оценка, защото няма приложимо правило или маршрут в реално време.",
    en: "A development fallback was used because no matching matrix rule or live route was available.",
  },
  "Large job requires staff capacity review.": {
    bg: "Голямата задача изисква служебен преглед на капацитета.",
    en: "The large job requires staff capacity review.",
  },
  "Parking/access time requires staff confirmation.": {
    bg: "Времето за паркиране или достъп изисква служебно потвърждение.",
    en: "Parking or access time requires staff confirmation.",
  },
} as const satisfies Record<string, Record<AuthLocale, string>>;

const appointmentWindowLabels = {
  EARLY_MORNING: { bg: "Рано сутрин", en: "Early morning" },
  MORNING: { bg: "Сутрин", en: "Morning" },
  MIDDAY: { bg: "Около обяд", en: "Midday" },
  AFTERNOON: { bg: "Следобед", en: "Afternoon" },
  EVENING: { bg: "Вечер", en: "Evening" },
} as const satisfies Record<string, Record<AuthLocale, string>>;

export function schedulingWarning(
  locale: AuthLocale,
  warning: string,
): string {
  return (
    warningMessages[warning as keyof typeof warningMessages]?.[locale] ??
    (locale === "bg"
      ? "Необходим е допълнителен служебен преглед."
      : "Additional staff review is required.")
  );
}

export function schedulingAppointmentWindow(
  locale: AuthLocale,
  value: string | null,
): string | null {
  if (!value) return null;
  return value
    .split(" · ")
    .map((part) => {
      const key = part.trim().toUpperCase().replaceAll(" ", "_");
      return (
        appointmentWindowLabels[
          key as keyof typeof appointmentWindowLabels
        ]?.[locale] ?? part
      );
    })
    .join(" · ");
}

export const schedulingContent = {
  bg: {
    common: {
      noValue: "Няма стойност",
      open: "Отвори",
      back: "Назад",
      retry: "Опитайте отново",
      minutes: (value) => `${value} мин`,
      date: (value) => date("bg", value),
      dateTime: (value) => dateTime("bg", value),
    },
    dispatch: {
      eyebrow: "Операции и график",
      title: "Дневен график",
      intro:
        "Потвърдени посещения, свободен оперативен капацитет и резервации, които очакват преглед.",
      previousDay: "Предишен ден",
      today: "Днес",
      nextDay: "Следващ ден",
      chooseDate: "Дата на графика",
      openDate: "Покажи датата",
      unscheduledTitle: "Очакващи насрочване",
      unscheduledEmpty: "Няма резервации, които очакват насрочване.",
      teamsTitle: "График по екипи",
      teamEmpty: "Няма потвърдени посещения за този екип.",
      preferredTiming: "Предпочитание на клиента",
      bookingReference: "Резервация",
      bookingStatus: "Статус на резервацията",
      jobReference: "Работна задача",
      jobStatus: "Статус на задачата",
      jobNotPrepared: "Няма подготвена задача",
      area: "Район",
      duration: "Продължителност на услугата",
      readiness: "Готовност",
      equipment: "Оборудване",
      serviceTime: "Точен час на услугата",
      travel: "Пътуване",
      buffer: "Оперативен буфер",
      metricsTitle: "Капацитет за деня",
      scheduledJobs: "Насрочени посещения",
      serviceMinutes: "Минути услуга",
      travelMinutes: "Минути пътуване",
      bufferMinutes: "Минути буфер",
      idleMinutes: "Свободни минути",
      utilization: "Заетост на екипите",
      occupiedTeamHours: "Заети екип-часове",
      laborHours: "Планирани човекочасове",
      revenuePerOccupiedTeamHour: "Приход на зает екип-час",
      provisionalTitle: "Временна оперативна конфигурация",
      provisionalText:
        "Работното време, зоните, матрицата за пътуване и капацитетът са DRAFT допускания за преглед, а не обещание към клиент.",
      fallbackTravel:
        "Оценката за пътуване използва резервно правило или е несигурна. Необходим е служебен преглед.",
    },
    booking: {
      eyebrow: "Преглед за насрочване",
      title: (reference) => `Насрочване на ${reference}`,
      intro:
        "Изберете само кандидат, изчислен от сървъра. Цената, приетата оферта и заявената продължителност не се преизчисляват.",
      currentAppointment: "Текущ потвърден час",
      noAppointment: "Все още няма потвърден точен час.",
      candidatesTitle: "Кандидат часове",
      candidatesEmpty:
        "Няма безопасен кандидат за тази дата. Оставете резервацията за служебен преглед.",
      candidateRank: (rank) => `Кандидат №${rank}`,
      selectCandidate: "Избери този кандидат",
      reasonCategory: "Причина за пренасрочване",
      reasonText: "Допълнителна бележка",
      reasonHint:
        "Кратък оперативен контекст без платежни данни, пароли или други тайни.",
      acknowledgement:
        "Проверих клиента, адреса, екипа, оборудването и видимите предупреждения.",
      confirmationTitle: "Потвърдете точния час",
      confirmationDescription:
        "Това ще запише точния час и сървърно проверените екип, оборудване, пътуване и буфери. Проверете избрания кандидат преди потвърждение.",
      confirmationCancel: "Назад към прегледа",
      scheduleSubmit: "Потвърди точния час",
      rescheduleSubmit: "Потвърди пренасрочването",
      pending: "Проверка и записване…",
      invalid: "Проверете задължителните полета.",
      safeError: "Графикът не може да бъде променен в момента.",
      denied: "Нямате достъп до тази операция.",
      limited: "Твърде много опити. Изчакайте и опитайте отново.",
      conflict: "Графикът е променен. Презаредете и изберете нов кандидат.",
      reviewRequired:
        "Необходим е служебен преглед. Не е направена автоматична промяна.",
      scheduled: "Точният час, екипът и необходимото оборудване са потвърдени.",
      rescheduled: "Новият точен час е потвърден, а предишният остава в историята.",
      noChange: "Този точен час вече е записан.",
      exactEndNotice:
        "Крайният час, пътуването и буферите се определят от сървъра от неизменната продължителност и текущия график.",
    },
    today: {
      eyebrow: "Работа на терен",
      title: "Днешни посещения",
      intro:
        "Оперативен изглед за текущо назначения екип и точните задачи за днешния ден.",
      back: "Всички работни задачи",
    },
    readiness: {
      READY: "Готово",
      MISSING_TEAM: "Липсва екип",
      MISSING_EQUIPMENT: "Липсва оборудване",
      SCHEDULE_CONFLICT: "Конфликт в графика",
      TRAVEL_REVIEW: "Преглед на пътуването",
      CAPABILITY_REVIEW: "Преглед на способностите",
      CUSTOMER_REVIEW: "Преглед на клиентските данни",
    },
    reasons: {
      CUSTOMER_REQUEST: "По искане на клиента",
      OPERATIONAL: "Оперативна причина",
      TEAM_UNAVAILABLE: "Екипът не е наличен",
      EQUIPMENT_UNAVAILABLE: "Оборудването не е налично",
      TRAVEL_CONFLICT: "Конфликт при пътуването",
      OTHER: "Друга записана причина",
    },
    states: {
      loadingTitle: "Зареждане на графика…",
      loadingText: "Проверяваме актуалния оперативен капацитет.",
      errorTitle: "Графикът не можа да се зареди",
      errorText:
        "Опитайте отново. Ако проблемът продължи, проверете наблюдението на приложението.",
    },
  },
  en: {
    common: {
      noValue: "Not provided",
      open: "Open",
      back: "Back",
      retry: "Try again",
      minutes: (value) => `${value} min`,
      date: (value) => date("en", value),
      dateTime: (value) => dateTime("en", value),
    },
    dispatch: {
      eyebrow: "Operations and schedule",
      title: "Daily dispatch",
      intro:
        "Confirmed visits, available operational capacity, and bookings awaiting review.",
      previousDay: "Previous day",
      today: "Today",
      nextDay: "Next day",
      chooseDate: "Schedule date",
      openDate: "Show date",
      unscheduledTitle: "Awaiting scheduling",
      unscheduledEmpty: "No bookings are awaiting scheduling.",
      teamsTitle: "Schedule by team",
      teamEmpty: "No confirmed visits for this team.",
      preferredTiming: "Customer preference",
      bookingReference: "Booking",
      bookingStatus: "Booking status",
      jobReference: "Field job",
      jobStatus: "Job status",
      jobNotPrepared: "No field job prepared",
      area: "Area",
      duration: "Service duration",
      readiness: "Readiness",
      equipment: "Equipment",
      serviceTime: "Exact service time",
      travel: "Travel",
      buffer: "Operational buffer",
      metricsTitle: "Daily capacity",
      scheduledJobs: "Scheduled visits",
      serviceMinutes: "Service minutes",
      travelMinutes: "Travel minutes",
      bufferMinutes: "Buffer minutes",
      idleMinutes: "Idle minutes",
      utilization: "Team utilization",
      occupiedTeamHours: "Occupied team-hours",
      laborHours: "Planned labor-hours",
      revenuePerOccupiedTeamHour: "Revenue per occupied team-hour",
      provisionalTitle: "Provisional operational configuration",
      provisionalText:
        "Working hours, zones, the travel matrix, and capacity are DRAFT assumptions for review, not a customer promise.",
      fallbackTravel:
        "The travel estimate used a fallback rule or is uncertain. Staff review is required.",
    },
    booking: {
      eyebrow: "Scheduling review",
      title: (reference) => `Schedule ${reference}`,
      intro:
        "Select only a server-generated candidate. Price, accepted quote evidence, and quoted duration are never recalculated.",
      currentAppointment: "Current confirmed appointment",
      noAppointment: "No exact appointment has been confirmed yet.",
      candidatesTitle: "Candidate times",
      candidatesEmpty:
        "No safe candidate is available for this date. Leave the booking for staff review.",
      candidateRank: (rank) => `Candidate ${rank}`,
      selectCandidate: "Select this candidate",
      reasonCategory: "Reschedule reason",
      reasonText: "Additional note",
      reasonHint:
        "Brief operational context without payment data, passwords, or other secrets.",
      acknowledgement:
        "I reviewed the customer, address, team, equipment, and visible warnings.",
      confirmationTitle: "Confirm the exact appointment",
      confirmationDescription:
        "This records the exact time and the server-verified team, equipment, travel, and buffers. Review the selected candidate before confirming.",
      confirmationCancel: "Back to review",
      scheduleSubmit: "Confirm exact appointment",
      rescheduleSubmit: "Confirm reschedule",
      pending: "Checking and saving…",
      invalid: "Check the required fields.",
      safeError: "The schedule cannot be changed right now.",
      denied: "You do not have access to this operation.",
      limited: "Too many attempts. Wait and try again.",
      conflict: "The schedule changed. Reload and select a new candidate.",
      reviewRequired:
        "Staff review is required. No automatic change was made.",
      scheduled: "The exact time, team, and required equipment are confirmed.",
      rescheduled:
        "The new exact time is confirmed and the previous appointment remains in history.",
      noChange: "This exact appointment is already recorded.",
      exactEndNotice:
        "The server derives the end time, travel, and buffers from immutable duration evidence and the current schedule.",
    },
    today: {
      eyebrow: "Field operations",
      title: "Today's visits",
      intro:
        "An operational view of the currently assigned team and today's exact jobs.",
      back: "All field jobs",
    },
    readiness: {
      READY: "Ready",
      MISSING_TEAM: "Missing team",
      MISSING_EQUIPMENT: "Missing equipment",
      SCHEDULE_CONFLICT: "Schedule conflict",
      TRAVEL_REVIEW: "Travel review",
      CAPABILITY_REVIEW: "Capability review",
      CUSTOMER_REVIEW: "Customer review",
    },
    reasons: {
      CUSTOMER_REQUEST: "Customer request",
      OPERATIONAL: "Operational reason",
      TEAM_UNAVAILABLE: "Team unavailable",
      EQUIPMENT_UNAVAILABLE: "Equipment unavailable",
      TRAVEL_CONFLICT: "Travel conflict",
      OTHER: "Other recorded reason",
    },
    states: {
      loadingTitle: "Loading schedule…",
      loadingText: "Checking current operational capacity.",
      errorTitle: "The schedule could not be loaded",
      errorText:
        "Try again. If the problem continues, check application monitoring.",
    },
  },
} as const satisfies Record<AuthLocale, SchedulingContent>;

import type { AuthLocale } from "@/auth/validation";
import type {
  JobItemProgressOperation,
  JobItemStatus,
  JobProgressOperation,
  JobStatus,
  JobStatusPresentation,
  TreatmentPlanDecision,
  TreatmentResultClassification,
} from "./types";

type JobExecutionContent = Readonly<{
  list: Readonly<{
    title: string;
    emptyTitle: string;
    emptyText: string;
    open: string;
    scheduled: string;
    unscheduled: string;
    duration: string;
    team: string;
    unassigned: string;
    address: string;
    access: string;
    noAccess: string;
    customer: string;
    items: string;
    review: string;
  }>;
  detail: Readonly<{
    title: string;
    scheduled: string;
    unscheduled: string;
    duration: string;
    team: string;
    unassigned: string;
    address: string;
    customer: string;
    contact: string;
    contactUnavailable: string;
    phoneUnavailable: string;
    access: string;
    noAccess: string;
    parking: string;
    noParking: string;
    customerServiceNotes: string;
    review: string;
    items: string;
    noItems: string;
    planned: string;
    observed: string;
    confirmedTreatment: string;
    performed: string;
    notRecorded: string;
    service: string;
    item: string;
    quantity: string;
    measurement: string;
    condition: string;
    material: string;
    construction: string;
    issues: string;
    risks: string;
    addons: string;
    customerDescription: string;
    inspectedAt: string;
    confirmedAt: string;
    outcome: string;
    method: string;
    product: string;
    startedAt: string;
    completedAt: string;
    completionSummary: string;
    careInstructions: string;
    none: string;
  }>;
  history: Readonly<{
    staffTitle: string;
    customerTitle: string;
    customerIntro: string;
    property: string;
    noEntriesTitle: string;
    noEntriesText: string;
    completedAt: string;
    service: string;
    outcome: string;
    observed: string;
    treatment: string;
    performed: string;
    condition: string;
    material: string;
    construction: string;
    issues: string;
    risks: string;
    method: string;
    addons: string;
    product: string;
    summary: string;
    care: string;
    recommendedReviewDate: string;
    suggestedIntervalMonths: string;
    recommendationReason: string;
    months: string;
    none: string;
  }>;
  forms: Readonly<{
    check: string;
    submit: string;
    pending: string;
    progressTitle: string;
    progressIntro: string;
    inspectionTitle: string;
    inspectionIntro: string;
    cleaningItemType: string;
    measurementMode: string;
    quantity: string;
    areaHundredthsM2: string;
    seatCount: string;
    sides: string;
    oneSide: string;
    twoSides: string;
    condition: string;
    material: string;
    construction: string;
    measurement: string;
    choose: string;
    issues: string;
    risks: string;
    noKnownIssues: string;
    noKnownRisks: string;
    existingDamage: string;
    existingDamageNotes: string;
    colourfastnessConcern: string;
    moistureSensitivity: string;
    unsafeContamination: string;
    unsafeStructure: string;
    technicianNotes: string;
    planTitle: string;
    planIntro: string;
    outcome: string;
    method: string;
    treatmentLevel: string;
    mechanicalAction: string;
    treatmentApproach: string;
    addons: string;
    product: string;
    rationale: string;
    safetyAcknowledgement: string;
    itemProgressTitle: string;
    treatmentCompletionTitle: string;
    resultClassification: string;
    completionTitle: string;
    completionIntro: string;
    customerSummary: string;
    careInstructions: string;
    internalCompletionNotes: string;
    completionAcknowledgement: string;
  }>;
  statuses: Readonly<Record<JobStatus, JobStatusPresentation>>;
  itemStatuses: Readonly<Record<JobItemStatus, JobStatusPresentation>>;
  planDecisions: Readonly<Record<TreatmentPlanDecision, string>>;
  resultClassifications: Readonly<Record<TreatmentResultClassification, string>>;
  progressOperations: Readonly<Record<JobProgressOperation, string>>;
  itemProgressOperations: Readonly<Record<JobItemProgressOperation, string>>;
}>;

export const jobExecutionContent = {
  bg: {
    list: {
      title: "Работни задачи",
      emptyTitle: "Няма работни задачи",
      emptyText: "В момента няма задачи, достъпни за този екип.",
      open: "Отвори задачата",
      scheduled: "Планирано начало",
      unscheduled: "Не е насрочено",
      duration: "Планирана продължителност",
      team: "Назначен екип",
      unassigned: "Няма назначен екип",
      address: "Адрес на посещението",
      access: "Указания за достъп",
      noAccess: "Няма записани указания",
      customer: "Клиент",
      items: "Обекти за обработка",
      review: "Изисква преглед от служител",
    },
    detail: {
      title: "Работна задача",
      scheduled: "Планирано начало",
      unscheduled: "Не е насрочено",
      duration: "Планирана продължителност",
      team: "Назначен екип",
      unassigned: "Няма назначен екип",
      address: "Адрес на посещението",
      customer: "Клиент",
      contact: "Контакт за посещението",
      contactUnavailable: "Няма наличен контакт",
      phoneUnavailable: "Няма наличен телефон",
      access: "Указания за достъп",
      noAccess: "Няма записани указания",
      parking: "Указания за паркиране",
      noParking: "Няма записани указания",
      customerServiceNotes: "Бележки за услугата от клиента",
      review: "Причини за служебен преглед",
      items: "Обекти за обработка",
      noItems: "Няма обекти в задачата.",
      planned: "Планирано",
      observed: "Установено на място",
      confirmedTreatment: "Потвърдена обработка",
      performed: "Извършено",
      notRecorded: "Все още няма запис.",
      service: "Услуга",
      item: "Обект",
      quantity: "Количество",
      measurement: "Измерване",
      condition: "Състояние",
      material: "Материал",
      construction: "Конструкция",
      issues: "Проблеми",
      risks: "Рискове",
      addons: "Допълнения",
      customerDescription: "Описание от клиента",
      inspectedAt: "Проверено",
      confirmedAt: "Потвърдено",
      outcome: "Решение",
      method: "Метод",
      product: "Препарат",
      startedAt: "Започнато",
      completedAt: "Завършено",
      completionSummary: "Резюме за клиента",
      careInstructions: "Инструкции за последваща грижа",
      none: "Няма",
    },
    history: {
      staffTitle: "История на почистването",
      customerTitle: "Паспорт на почистването",
      customerIntro:
        "История само за извършени обработки на този обект.",
      property: "Имот",
      noEntriesTitle: "Няма завършени обработки",
      noEntriesText: "Все още няма история за този обект.",
      completedAt: "Завършено",
      service: "Услуга",
      outcome: "Резултат",
      observed: "Установено",
      treatment: "Потвърдена обработка",
      performed: "Извършено",
      condition: "Състояние",
      material: "Материал",
      construction: "Конструкция",
      issues: "Проблеми",
      risks: "Рискове",
      method: "Метод",
      addons: "Допълнения",
      product: "Препарат",
      summary: "Резюме",
      care: "Последваща грижа",
      recommendedReviewDate: "Препоръчана дата за преглед",
      suggestedIntervalMonths: "Препоръчителен интервал",
      recommendationReason: "Основание за препоръката",
      months: "месеца",
      none: "Няма",
    },
    forms: {
      check: "Проверете посочените полета.",
      submit: "Потвърди",
      pending: "Записване…",
      progressTitle: "Следваща стъпка",
      progressIntro:
        "Отбележете само действително настъпилата следваща стъпка.",
      inspectionTitle: "Проверка на място",
      inspectionIntro:
        "Запишете наблюдаваното. Разлика със заявеното се изпраща за служебен преглед, без автоматично преизчисляване.",
      cleaningItemType: "Установен вид обект",
      measurementMode: "Начин на измерване",
      quantity: "Количество",
      areaHundredthsM2: "Площ в стотни от кв. м",
      seatCount: "Брой места",
      sides: "Страни",
      oneSide: "Една страна",
      twoSides: "Две страни",
      condition: "Установено състояние",
      material: "Установен материал",
      construction: "Установена конструкция",
      measurement: "Установено измерване",
      choose: "Изберете",
      issues: "Установени проблеми",
      risks: "Установени рискове",
      noKnownIssues: "Няма установени проблеми",
      noKnownRisks: "Няма установени рискове",
      existingDamage: "Има видима предходна повреда",
      existingDamageNotes: "Описание на предходната повреда",
      colourfastnessConcern: "Има съмнение за устойчивостта на цвета",
      moistureSensitivity: "Материалът е чувствителен към влага",
      unsafeContamination: "Установено е опасно замърсяване",
      unsafeStructure: "Установено е опасно конструктивно състояние",
      technicianNotes: "Вътрешни наблюдения на техника",
      planTitle: "Потвърждение на обработката",
      planIntro:
        "Потвърдете безопасния план или изберете отказ, насочване или служебен преглед.",
      outcome: "Решение",
      method: "Метод на обработка",
      treatmentLevel: "Ниво на обработка",
      mechanicalAction: "Механично действие",
      treatmentApproach: "Подход за обработка",
      addons: "Одобрени допълнения",
      product: "Препарат",
      rationale: "Професионална обосновка",
      safetyAcknowledgement:
        "Потвърждавам, че изборът отразява проверката на място и няма да променя търговските условия.",
      itemProgressTitle: "Изпълнение на обработката",
      treatmentCompletionTitle: "Завършване на обработката",
      resultClassification: "Резултат от обработката",
      completionTitle: "Завършване на задачата",
      completionIntro:
        "Завършете само когато всички обекти имат краен безопасен резултат.",
      customerSummary: "Резюме за клиента",
      careInstructions: "Инструкции за последваща грижа",
      internalCompletionNotes: "Вътрешни бележки за завършването",
      completionAcknowledgement:
        "Потвърждавам, че записът отразява действително извършената работа.",
    },
    statuses: {
      PREPARED: { label: "Подготвена", tone: "muted" },
      READY: { label: "Готова", tone: "positive" },
      EN_ROUTE: { label: "На път", tone: "neutral" },
      ARRIVED: { label: "На адрес", tone: "neutral" },
      IN_PROGRESS: { label: "В изпълнение", tone: "warning" },
      REQUIRES_REVIEW: { label: "Изисква преглед", tone: "danger" },
      COMPLETED: { label: "Завършена", tone: "positive" },
      CANCELLED: { label: "Отменена", tone: "muted" },
    },
    itemStatuses: {
      PENDING_INSPECTION: { label: "Очаква проверка", tone: "muted" },
      INSPECTED: { label: "Проверено", tone: "neutral" },
      TREATMENT_CONFIRMED: { label: "Обработката е потвърдена", tone: "positive" },
      IN_PROGRESS: { label: "В изпълнение", tone: "warning" },
      COMPLETED: { label: "Завършено", tone: "positive" },
      DECLINED: { label: "Отказано", tone: "muted" },
      REFERRED: { label: "Насочено", tone: "warning" },
      REQUIRES_REVIEW: { label: "Изисква преглед", tone: "danger" },
    },
    planDecisions: {
      PERFORM: "Извършване",
      PERFORM_WITH_LIMITATIONS: "Извършване с ограничения",
      DECLINE: "Отказ",
      REFER: "Насочване към специалист",
      REQUIRES_REVIEW: "Служебен преглед",
    },
    resultClassifications: {
      COMPLETED_AS_PLANNED: "Завършено според плана",
      COMPLETED_WITH_LIMITATIONS: "Завършено с ограничения",
      PARTIAL_IMPROVEMENT: "Частично подобрение",
      NO_OBSERVABLE_IMPROVEMENT: "Без видимо подобрение",
      STOPPED_FOR_SAFETY: "Спряно поради риск",
    },
    progressOperations: {
      START_TRAVEL: "Отбележи тръгване",
      MARK_ARRIVED: "Отбележи пристигане",
      START_WORK: "Започни работа",
    },
    itemProgressOperations: {
      START_TREATMENT: "Започни обработката",
    },
  },
  en: {
    list: {
      title: "Field jobs",
      emptyTitle: "No field jobs",
      emptyText: "There are currently no jobs available to this team.",
      open: "Open job",
      scheduled: "Scheduled start",
      unscheduled: "Not scheduled",
      duration: "Planned duration",
      team: "Assigned team",
      unassigned: "No team assigned",
      address: "Visit address",
      access: "Access instructions",
      noAccess: "No instructions recorded",
      customer: "Customer",
      items: "Items to treat",
      review: "Staff review required",
    },
    detail: {
      title: "Field job",
      scheduled: "Scheduled start",
      unscheduled: "Not scheduled",
      duration: "Planned duration",
      team: "Assigned team",
      unassigned: "No team assigned",
      address: "Visit address",
      customer: "Customer",
      contact: "Visit contact",
      contactUnavailable: "No contact available",
      phoneUnavailable: "No phone available",
      access: "Access instructions",
      noAccess: "No instructions recorded",
      parking: "Parking instructions",
      noParking: "No instructions recorded",
      customerServiceNotes: "Customer service notes",
      review: "Staff-review reasons",
      items: "Items to treat",
      noItems: "There are no items in this job.",
      planned: "Planned",
      observed: "Observed on site",
      confirmedTreatment: "Confirmed treatment",
      performed: "Performed",
      notRecorded: "Nothing has been recorded yet.",
      service: "Service",
      item: "Item",
      quantity: "Quantity",
      measurement: "Measurement",
      condition: "Condition",
      material: "Material",
      construction: "Construction",
      issues: "Issues",
      risks: "Risks",
      addons: "Add-ons",
      customerDescription: "Customer description",
      inspectedAt: "Inspected",
      confirmedAt: "Confirmed",
      outcome: "Outcome",
      method: "Method",
      product: "Product",
      startedAt: "Started",
      completedAt: "Completed",
      completionSummary: "Customer summary",
      careInstructions: "After-care instructions",
      none: "None",
    },
    history: {
      staffTitle: "Cleaning history",
      customerTitle: "Cleaning passport",
      customerIntro:
        "A history of completed treatment records for this asset only.",
      property: "Property",
      noEntriesTitle: "No completed treatments",
      noEntriesText: "This asset has no cleaning history yet.",
      completedAt: "Completed",
      service: "Service",
      outcome: "Outcome",
      observed: "Observed",
      treatment: "Confirmed treatment",
      performed: "Performed",
      condition: "Condition",
      material: "Material",
      construction: "Construction",
      issues: "Issues",
      risks: "Risks",
      method: "Method",
      addons: "Add-ons",
      product: "Product",
      summary: "Summary",
      care: "After-care",
      recommendedReviewDate: "Recommended review date",
      suggestedIntervalMonths: "Suggested interval",
      recommendationReason: "Recommendation reason",
      months: "months",
      none: "None",
    },
    forms: {
      check: "Check the highlighted fields.",
      submit: "Confirm",
      pending: "Saving…",
      progressTitle: "Next step",
      progressIntro: "Record only the next step that has actually happened.",
      inspectionTitle: "On-site inspection",
      inspectionIntro:
        "Record what you observe. A mismatch with the planned facts is sent for staff review without automatic recalculation.",
      cleaningItemType: "Observed item type",
      measurementMode: "Measurement mode",
      quantity: "Quantity",
      areaHundredthsM2: "Area in hundredths of a square metre",
      seatCount: "Seat count",
      sides: "Sides",
      oneSide: "One side",
      twoSides: "Two sides",
      condition: "Observed condition",
      material: "Observed material",
      construction: "Observed construction",
      measurement: "Observed measurement",
      choose: "Choose",
      issues: "Observed issues",
      risks: "Observed risks",
      noKnownIssues: "No observed issues",
      noKnownRisks: "No observed risks",
      existingDamage: "Existing damage is visible",
      existingDamageNotes: "Existing-damage description",
      colourfastnessConcern: "There is a colourfastness concern",
      moistureSensitivity: "The material is moisture-sensitive",
      unsafeContamination: "Unsafe contamination is present",
      unsafeStructure: "An unsafe structural condition is present",
      technicianNotes: "Internal technician observations",
      planTitle: "Confirm treatment",
      planIntro:
        "Confirm a safe plan, or choose decline, referral, or staff review.",
      outcome: "Outcome",
      method: "Treatment method",
      treatmentLevel: "Treatment level",
      mechanicalAction: "Mechanical action",
      treatmentApproach: "Treatment approach",
      addons: "Approved add-ons",
      product: "Product",
      rationale: "Professional rationale",
      safetyAcknowledgement:
        "I confirm that this selection reflects the on-site inspection and does not change the commercial terms.",
      itemProgressTitle: "Treatment execution",
      treatmentCompletionTitle: "Complete treatment",
      resultClassification: "Treatment result",
      completionTitle: "Complete job",
      completionIntro:
        "Complete only after every item has a safe final outcome.",
      customerSummary: "Customer summary",
      careInstructions: "After-care instructions",
      internalCompletionNotes: "Internal completion notes",
      completionAcknowledgement:
        "I confirm that this record reflects the work actually performed.",
    },
    statuses: {
      PREPARED: { label: "Prepared", tone: "muted" },
      READY: { label: "Ready", tone: "positive" },
      EN_ROUTE: { label: "En route", tone: "neutral" },
      ARRIVED: { label: "Arrived", tone: "neutral" },
      IN_PROGRESS: { label: "In progress", tone: "warning" },
      REQUIRES_REVIEW: { label: "Requires review", tone: "danger" },
      COMPLETED: { label: "Completed", tone: "positive" },
      CANCELLED: { label: "Cancelled", tone: "muted" },
    },
    itemStatuses: {
      PENDING_INSPECTION: { label: "Awaiting inspection", tone: "muted" },
      INSPECTED: { label: "Inspected", tone: "neutral" },
      TREATMENT_CONFIRMED: { label: "Treatment confirmed", tone: "positive" },
      IN_PROGRESS: { label: "In progress", tone: "warning" },
      COMPLETED: { label: "Completed", tone: "positive" },
      DECLINED: { label: "Declined", tone: "muted" },
      REFERRED: { label: "Referred", tone: "warning" },
      REQUIRES_REVIEW: { label: "Requires review", tone: "danger" },
    },
    planDecisions: {
      PERFORM: "Perform",
      PERFORM_WITH_LIMITATIONS: "Perform with limitations",
      DECLINE: "Decline",
      REFER: "Refer to a specialist",
      REQUIRES_REVIEW: "Staff review",
    },
    resultClassifications: {
      COMPLETED_AS_PLANNED: "Completed as planned",
      COMPLETED_WITH_LIMITATIONS: "Completed with limitations",
      PARTIAL_IMPROVEMENT: "Partial improvement",
      NO_OBSERVABLE_IMPROVEMENT: "No observable improvement",
      STOPPED_FOR_SAFETY: "Stopped for safety",
    },
    progressOperations: {
      START_TRAVEL: "Mark en route",
      MARK_ARRIVED: "Mark arrived",
      START_WORK: "Start work",
    },
    itemProgressOperations: {
      START_TREATMENT: "Start treatment",
    },
  },
} as const satisfies Record<AuthLocale, JobExecutionContent>;

export type CatalogueLocale = "bg" | "en";

export type LocalizedText = Readonly<Record<CatalogueLocale, string>>;

export type LocalizedReference<Code extends string = string> = Readonly<{
  code: Code;
  label: LocalizedText;
  description: LocalizedText;
  sortOrder: number;
  active: boolean;
}>;

function reference<const Code extends string>(
  code: Code,
  sortOrder: number,
  labelBg: string,
  labelEn: string,
  descriptionBg: string,
  descriptionEn: string,
): LocalizedReference<Code> {
  return {
    code,
    label: { bg: labelBg, en: labelEn },
    description: { bg: descriptionBg, en: descriptionEn },
    sortOrder,
    active: true,
  };
}

export function getCatalogueLabel(
  entry: Pick<LocalizedReference, "label">,
  locale: CatalogueLocale,
): string {
  return entry.label[locale];
}

export const measurementModes = [
  reference(
    "AREA_M2",
    10,
    "Площ (m²)",
    "Area (m²)",
    "Измерване по обработвана площ в квадратни метри.",
    "Measurement by treated surface area in square metres.",
  ),
  reference(
    "PER_ITEM",
    20,
    "На брой",
    "Per item",
    "Измерване по отделен физически артикул.",
    "Measurement by individual physical item.",
  ),
  reference(
    "PER_SEAT",
    30,
    "На седящо място",
    "Per seat",
    "Измерване по използваемо седящо място при мека мебел.",
    "Measurement by usable upholstered seating position.",
  ),
  reference(
    "LINEAR_METER",
    40,
    "Линеен метър",
    "Linear metre",
    "Линейно измерване за подходящи дълги или тесни повърхности.",
    "Linear measurement for suitable long or narrow surfaces.",
  ),
  reference(
    "CUSTOM_ASSESSMENT",
    50,
    "Индивидуална оценка",
    "Custom assessment",
    "Обхватът се определя след индивидуална оценка, без стандартна мерна единица.",
    "Scope is determined after individual assessment without a standard unit.",
  ),
] as const;

export type MeasurementModeCode = (typeof measurementModes)[number]["code"];

export const serviceCategories = [
  reference(
    "CARPET_FLOORING",
    10,
    "Мокети и килимени настилки",
    "Carpets & fitted carpet",
    "Фиксирани и други текстилни подови настилки.",
    "Fitted and other textile floor coverings.",
  ),
  reference(
    "RUGS",
    20,
    "Килими и пътеки",
    "Rugs & runners",
    "Свободно положени килими и текстилни пътеки.",
    "Loose-laid rugs and textile runners.",
  ),
  reference(
    "UPHOLSTERED_FURNITURE",
    30,
    "Мека мебел",
    "Upholstered furniture",
    "Дивани, столове и други мебели с текстилна тапицерия.",
    "Sofas, chairs and other textile-upholstered furniture.",
  ),
  reference(
    "MATTRESSES",
    40,
    "Матраци",
    "Mattresses",
    "Подходящи достъпни текстилни повърхности на матраци.",
    "Suitable accessible textile surfaces on mattresses.",
  ),
  reference(
    "COMMERCIAL_TEXTILE_SURFACES",
    50,
    "Текстилни повърхности за бизнес обекти",
    "Commercial textile surfaces",
    "Мокети и тапицирани повърхности в подходящи бизнес пространства.",
    "Carpet and upholstered surfaces in suitable commercial premises.",
  ),
  reference(
    "SPECIALIST_TEXTILE_CARE",
    60,
    "Специализирана грижа за текстил",
    "Specialist textile care",
    "Оценка на деликатни, ценни или неясни като състав текстилни изделия.",
    "Assessment of delicate, valuable or composition-uncertain textiles.",
  ),
] as const;

export type ServiceCategoryCode =
  (typeof serviceCategories)[number]["code"];

export const reuseAdvisoryCategories = [
  reference(
    "NOT_DETERMINED",
    10,
    "Не е определено",
    "Not determined",
    "Няма предварително определена категория за връщане към употреба.",
    "No return-to-use advisory category has been determined.",
  ),
  reference(
    "ITEM_SPECIFIC_GUIDANCE",
    20,
    "Насоки според конкретния артикул",
    "Item-specific guidance",
    "Насоките зависят от материята, конструкцията, метода и условията на място.",
    "Guidance depends on material, construction, method and site conditions.",
  ),
] as const;

export type ReuseAdvisoryCategoryCode =
  (typeof reuseAdvisoryCategories)[number]["code"];

type ServiceDefinition = LocalizedReference &
  Readonly<{
    categoryCode: ServiceCategoryCode;
    publicSlug: string | null;
    baseSetupMinutes: number | null;
    durationMinutesPerUnit: number | null;
    complexityMultiplierEligible: boolean | null;
    minimumServiceDurationMinutes: number | null;
    inspectionRequired: boolean;
    instantQuoteEligible: boolean;
    reuseAdvisoryCategoryCode: ReuseAdvisoryCategoryCode;
  }>;

export const services = ([
  {
    ...reference(
      "CARPET_CARE",
      10,
      "Почистване на мокети",
      "Carpet care",
      "Професионална грижа за фиксирани текстилни настилки в жилищни пространства.",
      "Professional care for fitted textile flooring in residential spaces.",
    ),
    categoryCode: "CARPET_FLOORING",
    publicSlug: "carpet-cleaning",
  },
  {
    ...reference(
      "RUG_RUNNER_CARE",
      20,
      "Грижа за килими и пътеки",
      "Rug & runner care",
      "Оценка и подходяща грижа за килими и пътеки, когато обработката е подходяща.",
      "Assessment-led care for rugs and runners where treatment is suitable.",
    ),
    categoryCode: "RUGS",
    publicSlug: "rug-cleaning",
  },
  {
    ...reference(
      "UPHOLSTERY_CARE",
      30,
      "Почистване на мека мебел",
      "Upholstery care",
      "Грижа за дивани, кресла, столове и други подходящи тапицирани мебели.",
      "Care for sofas, armchairs, chairs and other suitable upholstered furniture.",
    ),
    categoryCode: "UPHOLSTERED_FURNITURE",
    publicSlug: "sofa-upholstery-cleaning",
  },
  {
    ...reference(
      "MATTRESS_CARE",
      40,
      "Почистване на матраци",
      "Mattress care",
      "Поддръжка на подходящи текстилни повърхности на матраци без медицински твърдения.",
      "Maintenance of suitable mattress textile surfaces without medical claims.",
    ),
    categoryCode: "MATTRESSES",
    publicSlug: "mattress-cleaning",
  },
  {
    ...reference(
      "COMMERCIAL_TEXTILE_CARE",
      50,
      "Почистване на текстилни повърхности в бизнес обекти",
      "Commercial textile care",
      "Планирана грижа за подходящи мокети и тапицирани повърхности в бизнес обекти.",
      "Planned care for suitable carpet and upholstery in commercial premises.",
    ),
    categoryCode: "COMMERCIAL_TEXTILE_SURFACES",
    publicSlug: "office-carpet-cleaning",
  },
  {
    ...reference(
      "DELICATE_TEXTILE_ASSESSMENT",
      60,
      "Оценка на деликатни текстилни изделия",
      "Delicate textile assessment",
      "Първоначална оценка за деликатни, ценни, стари или неясни материали.",
      "Decision-first assessment for delicate, valuable, aged or uncertain materials.",
    ),
    categoryCode: "SPECIALIST_TEXTILE_CARE",
    publicSlug: "delicate-fabric-care",
  },
] as const).map(
  (entry) =>
    ({
      ...entry,
      baseSetupMinutes: null,
      durationMinutesPerUnit: null,
      complexityMultiplierEligible: null,
      minimumServiceDurationMinutes: null,
      inspectionRequired: true,
      instantQuoteEligible: false,
      reuseAdvisoryCategoryCode: "ITEM_SPECIFIC_GUIDANCE",
    }) satisfies ServiceDefinition,
);

export type ServiceCode = (typeof services)[number]["code"];
export type PublicServiceSlug = NonNullable<
  (typeof services)[number]["publicSlug"]
>;

type CleaningItemTypeDefinition = LocalizedReference &
  Readonly<{ categoryCode: ServiceCategoryCode }>;

export const cleaningItemTypes = [
  {
    ...reference("CARPET_FIXED", 10, "Фиксиран мокет", "Fitted carpet", "Фиксирана текстилна подова настилка.", "Fixed textile floor covering."),
    categoryCode: "CARPET_FLOORING",
  },
  {
    ...reference("RUG", 20, "Килим", "Rug", "Свободно положен текстилен килим.", "Loose-laid textile rug."),
    categoryCode: "RUGS",
  },
  {
    ...reference("RUNNER", 30, "Пътека", "Runner", "Дълга или тясна свободно положена текстилна пътека.", "Long or narrow loose-laid textile runner."),
    categoryCode: "RUGS",
  },
  {
    ...reference("SOFA_2_SEAT", 40, "Двуместен диван", "2-seat sofa", "Диван с приблизително две седящи места.", "Sofa with approximately two seating positions."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("SOFA_3_SEAT", 50, "Триместен диван", "3-seat sofa", "Диван с приблизително три седящи места.", "Sofa with approximately three seating positions."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("SOFA_4_PLUS", 60, "Диван с четири или повече места", "4+ seat sofa", "Прав диван с четири или повече седящи места.", "Straight sofa with four or more seating positions."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("SOFA_CORNER", 70, "Ъглов диван", "Corner sofa", "Ъглова или L-образна мека мебел.", "Corner or L-shaped upholstered seating."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("SOFA_U_SHAPED", 80, "U-образен диван", "U-shaped sofa", "Голяма U-образна мека мебел.", "Large U-shaped upholstered seating."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("SOFA_BED", 90, "Разтегателен диван", "Sofa bed", "Диван с разтегателен или спален механизъм.", "Sofa with a pull-out or sleeping mechanism."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("ARMCHAIR", 100, "Фотьойл", "Armchair", "Самостоятелно тапицирано кресло.", "Individual upholstered armchair."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("DINING_CHAIR_UPHOLSTERED", 110, "Тапициран трапезен стол", "Upholstered dining chair", "Трапезен стол с текстилна тапицерия.", "Dining chair with textile upholstery."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("OFFICE_CHAIR_UPHOLSTERED", 120, "Тапициран офис стол", "Upholstered office chair", "Офис стол с подходяща текстилна тапицерия.", "Office chair with suitable textile upholstery."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("BENCH_UPHOLSTERED", 130, "Тапицирана пейка", "Upholstered bench", "Пейка или банкетка с текстилна тапицерия.", "Bench or banquette with textile upholstery."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("OTTOMAN", 140, "Табуретка или пуф", "Ottoman", "Тапицирана табуретка, пуф или отоманка.", "Upholstered stool, pouffe or ottoman."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("HEADBOARD", 150, "Тапицирана табла", "Headboard", "Табла за легло с подходяща текстилна тапицерия.", "Bed headboard with suitable textile upholstery."),
    categoryCode: "UPHOLSTERED_FURNITURE",
  },
  {
    ...reference("MATTRESS_SINGLE", 160, "Единичен матрак", "Single mattress", "Матрак с единичен размер.", "Single-size mattress."),
    categoryCode: "MATTRESSES",
  },
  {
    ...reference("MATTRESS_DOUBLE", 170, "Двоен матрак", "Double mattress", "Матрак със стандартен двоен размер.", "Standard double-size mattress."),
    categoryCode: "MATTRESSES",
  },
  {
    ...reference("MATTRESS_KING_OR_LARGE", 180, "Голям или king-size матрак", "King or large mattress", "Матрак с голям или king-size размер.", "Large or king-size mattress."),
    categoryCode: "MATTRESSES",
  },
  {
    ...reference("MATTRESS_CHILD", 190, "Детски матрак", "Child mattress", "Матрак за детско легло.", "Mattress for a child bed."),
    categoryCode: "MATTRESSES",
  },
  {
    ...reference("OFFICE_CARPET", 200, "Мокет в офис или бизнес обект", "Office or commercial carpet", "Фиксирана текстилна настилка в бизнес пространство.", "Fitted textile flooring in commercial premises."),
    categoryCode: "COMMERCIAL_TEXTILE_SURFACES",
  },
  {
    ...reference("COMMERCIAL_UPHOLSTERY", 210, "Тапицерия в бизнес обект", "Commercial upholstery", "Подходяща тапицирана повърхност в бизнес пространство.", "Suitable upholstered surface in commercial premises."),
    categoryCode: "COMMERCIAL_TEXTILE_SURFACES",
  },
  {
    ...reference("OTHER_TEXTILE_SURFACE", 220, "Друга текстилна повърхност", "Other textile surface", "Текстилна повърхност, която изисква индивидуално класифициране.", "Textile surface requiring individual classification."),
    categoryCode: "SPECIALIST_TEXTILE_CARE",
  },
] as const satisfies readonly CleaningItemTypeDefinition[];

export type CleaningItemTypeCode =
  (typeof cleaningItemTypes)[number]["code"];

function itemMeasurement(
  itemTypeCode: CleaningItemTypeCode,
  measurementModeCode: MeasurementModeCode,
  isDefault = false,
) {
  return { itemTypeCode, measurementModeCode, isDefault } as const;
}

export const cleaningItemTypeMeasurementModes = [
  itemMeasurement("CARPET_FIXED", "AREA_M2", true),
  itemMeasurement("RUG", "AREA_M2", true),
  itemMeasurement("RUG", "PER_ITEM"),
  itemMeasurement("RUNNER", "AREA_M2", true),
  itemMeasurement("RUNNER", "LINEAR_METER"),
  itemMeasurement("RUNNER", "PER_ITEM"),
  ...([
    "SOFA_2_SEAT",
    "SOFA_3_SEAT",
    "SOFA_4_PLUS",
    "SOFA_CORNER",
    "SOFA_U_SHAPED",
    "SOFA_BED",
  ] as const).flatMap((itemTypeCode) => [
    itemMeasurement(itemTypeCode, "PER_ITEM", true),
    itemMeasurement(itemTypeCode, "PER_SEAT"),
  ]),
  ...([
    "ARMCHAIR",
    "DINING_CHAIR_UPHOLSTERED",
    "OFFICE_CHAIR_UPHOLSTERED",
    "BENCH_UPHOLSTERED",
    "OTTOMAN",
    "HEADBOARD",
    "MATTRESS_SINGLE",
    "MATTRESS_DOUBLE",
    "MATTRESS_KING_OR_LARGE",
    "MATTRESS_CHILD",
  ] as const).map((itemTypeCode) =>
    itemMeasurement(itemTypeCode, "PER_ITEM", true),
  ),
  itemMeasurement("OFFICE_CARPET", "AREA_M2", true),
  itemMeasurement("COMMERCIAL_UPHOLSTERY", "PER_ITEM", true),
  itemMeasurement("COMMERCIAL_UPHOLSTERY", "PER_SEAT"),
  itemMeasurement("OTHER_TEXTILE_SURFACE", "CUSTOM_ASSESSMENT", true),
] as const;

export const fibreMaterials = [
  reference("UNKNOWN", 10, "Неизвестен състав", "Unknown composition", "Съставът не е установен.", "The composition has not been established."),
  reference("SYNTHETIC_GENERIC", 20, "Синтетично влакно — общо", "Synthetic fibre — generic", "Синтетично влакно без по-точно установен вид.", "Synthetic fibre without a more precise identification."),
  reference("POLYESTER", 30, "Полиестер", "Polyester", "Полиестерно влакно.", "Polyester fibre."),
  reference("POLYPROPYLENE", 40, "Полипропилен", "Polypropylene", "Полипропиленово влакно.", "Polypropylene fibre."),
  reference("POLYAMIDE_NYLON", 50, "Полиамид / найлон", "Polyamide / nylon", "Полиамидно или найлоново влакно.", "Polyamide or nylon fibre."),
  reference("ACRYLIC", 60, "Акрил", "Acrylic", "Акрилно влакно.", "Acrylic fibre."),
  reference("COTTON", 70, "Памук", "Cotton", "Памучно влакно.", "Cotton fibre."),
  reference("LINEN", 80, "Лен", "Linen", "Ленено влакно.", "Linen fibre."),
  reference("VISCOSE_RAYON", 90, "Вискоза / район", "Viscose / rayon", "Регенерирано целулозно влакно.", "Regenerated cellulose fibre."),
  reference("WOOL", 100, "Вълна", "Wool", "Вълнено влакно.", "Wool fibre."),
  reference("WOOL_BLEND", 110, "Смес с вълна", "Wool blend", "Смес от вълна и други влакна.", "Blend of wool and other fibres."),
  reference("SILK", 120, "Коприна", "Silk", "Копринено влакно, което изисква внимателна оценка.", "Silk fibre requiring careful assessment."),
  reference("MIXED_FIBRES", 130, "Смесени влакна", "Mixed fibres", "Състав от повече от един вид влакно.", "Composition containing more than one fibre type."),
  reference("NATURAL_SYNTHETIC_BLEND", 140, "Смес от естествени и синтетични влакна", "Natural / synthetic blend", "Смес от естествени и синтетични влакна.", "Blend of natural and synthetic fibres."),
  reference("OTHER", 150, "Друг установен състав", "Other identified composition", "Установен състав извън текущия контролиран списък.", "Identified composition outside the current controlled list."),
  reference("SPECIALIST_UNCERTAIN", 160, "Неясен състав — специализирана оценка", "Uncertain composition — specialist assessment", "Съставът остава неясен и изисква специализирана оценка.", "Composition remains uncertain and requires specialist assessment."),
] as const;

export type FibreMaterialCode = (typeof fibreMaterials)[number]["code"];

export const surfaceConstructions = [
  reference("UNKNOWN", 10, "Неизвестна конструкция", "Unknown construction", "Конструкцията или финишът не са установени.", "Construction or finish has not been established."),
  reference("WOVEN", 20, "Тъкан", "Woven", "Текстил с тъкана конструкция.", "Textile with a woven construction."),
  reference("TUFTED", 30, "Тафтинг", "Tufted", "Текстил с тафтинг конструкция.", "Textile with a tufted construction."),
  reference("LOOP_PILE", 40, "Букле / затворен косъм", "Loop pile", "Повърхност с неразрязани бримки.", "Surface with uncut loops."),
  reference("CUT_PILE", 50, "Рязан косъм", "Cut pile", "Повърхност с разрязан косъм.", "Surface with cut pile."),
  reference("SHAG_HIGH_PILE", 60, "Дълъг или висок косъм", "Shag / high pile", "Повърхност с дълъг или висок косъм.", "Surface with long or high pile."),
  reference("FLATWEAVE", 70, "Плоска тъкан", "Flatweave", "Плоско тъкана повърхност без изразен косъм.", "Flat-woven surface without pronounced pile."),
  reference("VELVET", 80, "Кадифена конструкция или финиш", "Velvet construction / finish", "Кадифето описва конструкция или финиш, а не конкретно влакно.", "Velvet describes construction or finish, not a specific fibre."),
  reference("CHENILLE", 90, "Шенилна конструкция или финиш", "Chenille construction / finish", "Шенилен ефект или конструкция на повърхността.", "Chenille surface effect or construction."),
  reference("MICROFIBRE_FINISH", 100, "Микрофибърен финиш", "Microfibre finish", "Описание на много фина повърхност; действителният влакнест състав се записва отделно.", "Description of a very fine surface; actual fibre composition is recorded separately."),
  reference("OTHER", 110, "Друга конструкция или финиш", "Other construction / finish", "Установена конструкция или финиш извън текущия списък.", "Identified construction or finish outside the current list."),
] as const;

export const conditionLevels = [
  reference("LIGHT_MAINTENANCE", 10, "Лека периодична поддръжка", "Light / maintenance", "Леко състояние, подходящо за периодична поддръжка.", "Light condition associated with routine maintenance."),
  reference("NORMAL", 20, "Нормално използване", "Normal", "Обичайни следи от използване без изразено тежко замърсяване.", "Ordinary use without pronounced heavy soiling."),
  reference("NOTICEABLY_SOILED", 30, "Видимо замърсено", "Noticeably soiled", "Видимо замърсяване или натоварени участъци.", "Visible soiling or traffic areas."),
  reference("HEAVILY_SOILED", 40, "Силно замърсено", "Heavily soiled", "Тежко или многокомпонентно замърсяване, което изисква по-подробна оценка.", "Heavy or multi-factor soiling requiring closer assessment."),
  reference("SPECIALIST_ASSESSMENT_REQUIRED", 50, "Необходима е специализирана оценка", "Specialist assessment required", "Състоянието или неизвестността налагат решение след специализирана оценка.", "Condition or uncertainty requires a specialist assessment decision."),
] as const;

export type ConditionLevelCode = (typeof conditionLevels)[number]["code"];

export const issueHandlingClassifications = [
  reference("STANDARD", 10, "Стандартна оценка", "Standard", "Може да бъде оценено в рамките на стандартния процес без гаранция за резултат.", "May be assessed in the standard process without guaranteeing an outcome."),
  reference("ASSESSMENT_REQUIRED", 20, "Необходима е допълнителна оценка", "Assessment required", "Изисква допълнителен контекст или проверка преди решение.", "Requires additional context or inspection before a decision."),
  reference("SPECIALIST_ONLY", 30, "Само специализиран подход", "Specialist only", "Не трябва да се приема като стандартна обработка.", "Must not be treated as a standard service capability."),
  reference("DECLINE_OR_REFER", 40, "Отказ или насочване към специалист", "Decline or refer", "Общата текстилна услуга може да откаже случая или да го насочи към подходящ специалист.", "The general textile service may decline or refer to an appropriate specialist."),
] as const;

export type IssueHandlingClassificationCode =
  (typeof issueHandlingClassifications)[number]["code"];

type IssueTypeDefinition = LocalizedReference &
  Readonly<{ handlingClassificationCode: IssueHandlingClassificationCode }>;

function issue(
  code: string,
  sortOrder: number,
  labelBg: string,
  labelEn: string,
  descriptionBg: string,
  descriptionEn: string,
  handlingClassificationCode: IssueHandlingClassificationCode,
): IssueTypeDefinition {
  return {
    ...reference(code, sortOrder, labelBg, labelEn, descriptionBg, descriptionEn),
    handlingClassificationCode,
  };
}

export const issueTypes = [
  issue("GENERAL_SOIL", 10, "Общо замърсяване", "General soil", "Натрупано общо замърсяване от употреба.", "General accumulated soil from use.", "STANDARD"),
  issue("DUST_ACCUMULATION", 20, "Натрупан прах", "Dust accumulation", "Видимо или заявено натрупване на прах.", "Visible or declared dust accumulation.", "STANDARD"),
  issue("FOOD_DRINK", 30, "Храна или напитка", "Food or drink", "Следа с вероятен произход от храна или напитка.", "Mark likely originating from food or drink.", "STANDARD"),
  issue("COFFEE_TEA", 40, "Кафе или чай", "Coffee or tea", "Следа с вероятен произход от кафе или чай.", "Mark likely originating from coffee or tea.", "STANDARD"),
  issue("WINE", 50, "Вино", "Wine", "Следа с вероятен произход от вино.", "Mark likely originating from wine.", "ASSESSMENT_REQUIRED"),
  issue("GREASE_OIL", 60, "Мазнина или масло", "Grease or oil", "Мазна или маслена следа.", "Greasy or oily mark.", "ASSESSMENT_REQUIRED"),
  issue("MUD", 70, "Кал", "Mud", "Следи от кал или внесена почва.", "Mud or tracked-in soil.", "STANDARD"),
  issue("PET_RELATED", 80, "Свързано с домашен любимец", "Pet-related", "Следа или миризма, заявена като свързана с домашен любимец.", "Mark or odour declared as pet-related.", "ASSESSMENT_REQUIRED"),
  issue("URINE_SUSPECTED", 90, "Предполагаема урина", "Urine suspected", "Предполагаемо, но непотвърдено замърсяване с урина.", "Suspected but unconfirmed urine contamination.", "ASSESSMENT_REQUIRED"),
  issue("ODOUR", 100, "Миризма", "Odour", "Заявена миризма без автоматично твърдение за източник или отстранимост.", "Declared odour without assuming source or removability.", "ASSESSMENT_REQUIRED"),
  issue("COSMETICS", 110, "Козметика", "Cosmetics", "Следа с вероятен произход от козметичен продукт.", "Mark likely originating from a cosmetic product.", "ASSESSMENT_REQUIRED"),
  issue("INK", 120, "Мастило", "Ink", "Следа с вероятен произход от мастило.", "Mark likely originating from ink.", "ASSESSMENT_REQUIRED"),
  issue("BLOOD_OR_BIOLOGICAL", 130, "Кръв или предполагаем биологичен материал", "Blood or suspected biological material", "Декларирано биологично замърсяване, което не е стандартна текстилна услуга.", "Declared biological contamination outside standard textile service capability.", "DECLINE_OR_REFER"),
  issue("UNKNOWN_STAIN", 140, "Петно с неизвестен произход", "Unknown stain", "Петно с неизвестен произход или състав.", "Stain of unknown origin or composition.", "ASSESSMENT_REQUIRED"),
  issue("OLD_STAIN", 150, "Старо петно", "Old stain", "Петно, заявено като старо или многократно обработвано.", "Stain declared as old or previously treated multiple times.", "ASSESSMENT_REQUIRED"),
  issue("COLOUR_TRANSFER", 160, "Пренос на цвят", "Colour transfer", "Предполагаем пренос или миграция на багрило.", "Suspected colour or dye transfer.", "SPECIALIST_ONLY"),
  issue("CHEWING_GUM", 170, "Дъвка", "Chewing gum", "Полепнала дъвка или подобен остатък.", "Adhered chewing gum or similar residue.", "ASSESSMENT_REQUIRED"),
  issue("WAX", 180, "Восък", "Wax", "Восък или восъкоподобен остатък.", "Wax or wax-like residue.", "ASSESSMENT_REQUIRED"),
  issue("OTHER", 190, "Друг проблем", "Other issue", "Друг заявен проблем, който изисква описание.", "Other declared issue requiring description.", "ASSESSMENT_REQUIRED"),
] as const;

export const riskFlags = [
  reference("DELICATE_MATERIAL", 10, "Деликатен материал", "Delicate material", "Материалът може да изисква ограничен или специализиран подход.", "Material may require a limited or specialist approach."),
  reference("UNKNOWN_FIBRE", 20, "Неизвестно влакно", "Unknown fibre", "Влакнестият състав не е установен.", "Fibre composition has not been established."),
  reference("VALUABLE_ITEM", 30, "Ценно изделие", "Valuable item", "Изделието е заявено или оценено като ценно.", "Item is declared or assessed as valuable."),
  reference("ANTIQUE_OR_VINTAGE", 40, "Антично или винтидж изделие", "Antique or vintage item", "Възрастта или произходът може да променят допустимия подход.", "Age or provenance may change the acceptable approach."),
  reference("COLOURFASTNESS_CONCERN", 50, "Съмнение за устойчивостта на цвета", "Colourfastness concern", "Има съмнение за устойчивостта или миграцията на цвета.", "There is concern about colour stability or migration."),
  reference("MOISTURE_SENSITIVE", 60, "Чувствителност към влага", "Moisture sensitive", "Материалът или конструкцията може да са чувствителни към влага.", "Material or construction may be moisture sensitive."),
  reference("EXISTING_DAMAGE", 70, "Съществуваща повреда", "Existing damage", "Налице е декларирана или наблюдавана предходна повреда.", "Pre-existing damage is declared or observed."),
  reference("HEAVY_WEAR", 80, "Силно износване", "Heavy wear", "Налице е значително износване.", "Significant wear is present."),
  reference("LOOSE_SEAMS", 90, "Разхлабени шевове", "Loose seams", "Налице са разхлабени или компрометирани шевове.", "Loose or compromised seams are present."),
  reference("FRAYING", 100, "Разнищване", "Fraying", "Налице е разнищване на влакна, ръбове или кантове.", "Fibres, edges or trims are fraying."),
  reference("SHRINKAGE_RISK", 110, "Риск от свиване", "Shrinkage risk", "Оценката показва възможен риск от свиване.", "Assessment indicates a possible shrinkage risk."),
  reference("DYE_BLEED_RISK", 120, "Риск от миграция на багрило", "Dye bleed risk", "Оценката показва възможен риск от миграция на багрило.", "Assessment indicates a possible dye-bleed risk."),
  reference("PREVIOUS_CHEMICAL_TREATMENT", 130, "Предишна химична обработка", "Previous chemical treatment", "Заявена или установена е предишна химична обработка.", "Previous chemical treatment is declared or identified."),
  reference("HANDMADE", 140, "Ръчна изработка", "Handmade", "Изделието е заявено или оценено като ръчно изработено.", "Item is declared or assessed as handmade."),
  reference("ORIENTAL_PERSIAN_STYLE", 150, "Ориенталски или персийски стил", "Oriental / Persian style", "Стилово описание, което само по себе си не удостоверява произход или стойност.", "Style description that does not itself establish provenance or value."),
  reference("CUSTOMER_DECLARED_SPECIAL_VALUE", 160, "Специална стойност, заявена от клиента", "Customer-declared special value", "Клиентът е заявил специална финансова или емоционална стойност.", "Customer has declared special financial or emotional value."),
  reference("OTHER", 170, "Друг рисков фактор", "Other risk flag", "Друг фактор за оценка, описан отделно.", "Other assessment factor described separately."),
] as const;

type TreatmentLevelDefinition = LocalizedReference &
  Readonly<{ customerSelectable: false }>;

export const treatmentLevels = [
  {
    ...reference("GENTLE_CARE", 10, "Щадяща грижа", "Gentle Care", "Ограничена интензивност при чувствителност, лека поддръжка или приоритет за съхраняване.", "Restrained intensity for sensitivity, light maintenance or preservation priorities."),
    customerSelectable: false,
  },
  {
    ...reference("REFRESH", 20, "Освежаване", "Refresh", "Редовна професионална грижа при общо замърсяване и подходящ материал.", "Routine professional care for general soil on a suitable material."),
    customerSelectable: false,
  },
  {
    ...reference("DEEP_CLEAN", 30, "Дълбоко почистване", "Deep Clean", "По-задълбочена обработка, съобразена с материята и конструкцията.", "More thorough treatment balanced against material and construction."),
    customerSelectable: false,
  },
  {
    ...reference("INTENSIVE", 40, "Интензивна обработка", "Intensive", "Фокусирана работа при по-тежко състояние, когато материалът позволява.", "Focused work for heavier conditions where the material permits."),
    customerSelectable: false,
  },
  {
    ...reference("SPECIALIST_ASSESSMENT", 50, "Специализирана оценка", "Specialist Assessment", "Решение дали и как да се работи при повишена неизвестност или риск.", "Decision on whether and how to proceed where uncertainty or risk is elevated."),
    customerSelectable: false,
  },
] as const satisfies readonly TreatmentLevelDefinition[];

export type TreatmentLevelCode = (typeof treatmentLevels)[number]["code"];

export const mechanicalActionLevels = [
  reference("NONE", 10, "Без механично действие", "None", "Не е планирано механично действие.", "No mechanical action is planned."),
  reference("MINIMAL", 20, "Минимално", "Minimal", "Минимално механично действие според оценката.", "Minimal mechanical action based on assessment."),
  reference("LIGHT", 30, "Леко", "Light", "Леко контролирано механично действие.", "Light controlled mechanical action."),
  reference("STANDARD", 40, "Стандартно", "Standard", "Стандартно контролирано механично действие за подходящ материал.", "Standard controlled mechanical action for a suitable material."),
  reference("ENHANCED", 50, "Засилено", "Enhanced", "Засилено действие само когато оценката го допуска.", "Enhanced action only where assessment permits it."),
  reference("SPECIALIST_ONLY", 60, "Само след специализирано решение", "Specialist only", "Механично действие само след специализирано решение.", "Mechanical action only after a specialist decision."),
] as const;

export const treatmentApproaches = [
  reference("LOW_MOISTURE", 10, "Подход с ограничена влага", "Low moisture", "Подход с контролирано ограничаване на влагата според материала.", "Approach that controls and limits moisture according to the material."),
  reference("EXTRACTION", 20, "Екстракция", "Extraction", "Екстракционен подход за подходящи материали и условия.", "Extraction approach for suitable materials and conditions."),
  reference("TARGETED_EXTRACTION", 30, "Локализирана екстракция", "Targeted extraction", "Екстракция, ограничена до конкретни подходящи зони.", "Extraction limited to specific suitable areas."),
  reference("SPECIALIST_METHOD", 40, "Специализиран метод", "Specialist method", "Метод, определен след специализирана оценка.", "Method determined after specialist assessment."),
  reference("NOT_DETERMINED", 50, "Не е определен", "Not determined", "Подходът още не е определен.", "The approach has not yet been determined."),
] as const;

export const cleaningProductCategories = [
  reference("GENERAL_CLEANING_AGENT", 10, "Общ почистващ препарат", "General cleaning agent", "Неутрална категория за бъдещ одобрен почистващ продукт.", "Neutral category for a future approved cleaning product."),
  reference("PRE_TREATMENT", 20, "Предварителна обработка", "Pre-treatment", "Категория за бъдещ одобрен продукт за предварителна обработка.", "Category for a future approved pre-treatment product."),
  reference("EXTRACTION_AGENT", 30, "Препарат за екстракция", "Extraction agent", "Категория за бъдещ одобрен продукт за екстракционен процес.", "Category for a future approved extraction-process product."),
  reference("RINSE_AGENT", 40, "Изплакващ препарат", "Rinse agent", "Категория за бъдещ одобрен изплакващ продукт.", "Category for a future approved rinse product."),
  reference("SPOT_TREATMENT_AGENT", 50, "Препарат за локална обработка", "Spot-treatment agent", "Категория за бъдещ одобрен продукт за локална обработка.", "Category for a future approved spot-treatment product."),
  reference("PROTECTIVE_TREATMENT_AGENT", 60, "Препарат за защитна обработка", "Protective-treatment agent", "Категория без твърдение, че конкретен продукт е одобрен или наличен.", "Category without claiming that a specific product is approved or available."),
  reference("OTHER", 70, "Друга продуктова категория", "Other product category", "Друга контролирана продуктова категория.", "Other controlled product category."),
] as const;

export type CleaningProductCategoryCode =
  (typeof cleaningProductCategories)[number]["code"];

export type CleaningProductDefinition = Readonly<{
  code: string;
  manufacturer: string | null;
  productName: string;
  categoryCode: CleaningProductCategoryCode;
  intendedApplication: string | null;
  compatibleMaterialNotes: string | null;
  dilutionGuidance: string | null;
  safetyDocumentReference: string | null;
  evidenceDocumentReference: string | null;
  active: boolean;
  internalNotes: string | null;
}>;

export const cleaningProducts = [] as const satisfies readonly CleaningProductDefinition[];

export const serviceAddons = [
  reference("STAIN_TARGETING", 10, "Локална работа по петна", "Stain targeting", "Условна локална работа след оценка без гаранция за пълно отстраняване.", "Conditional spot work after assessment without a complete-removal guarantee."),
  reference("ODOUR_TREATMENT", 20, "Обработка на миризма", "Odour treatment", "Условна работа по заявена миризма след оценка на източника и материала.", "Conditional work on a declared odour after source and material assessment."),
  reference("ADDITIONAL_EXTRACTION", 30, "Допълнителна екстракция", "Additional extraction", "Допълнителна екстракционна стъпка само когато материалът и условията я допускат.", "Additional extraction step only where material and conditions permit."),
  reference("DELICATE_MATERIAL_ASSESSMENT", 40, "Оценка на деликатен материал", "Delicate-material assessment", "Допълнителна оценка при чувствителен, ценен или неясен материал.", "Additional assessment for sensitive, valuable or uncertain material."),
  reference("PROTECTIVE_TREATMENT", 50, "Защитна обработка", "Protective treatment", "Бъдеща условна категория; не заявява наличен продукт или доказан ефект.", "Future conditional category; does not claim an available product or proven effect."),
  reference("OTHER", 60, "Друга условна обработка", "Other conditional treatment", "Друга условна обработка, която изисква отделно одобрение.", "Other conditional treatment requiring separate approval."),
] as const;

export type ServiceAddonCode = (typeof serviceAddons)[number]["code"];

export const capabilityStatuses = [
  reference("STANDARD", 10, "Стандартно допустимо след оценка", "Standard after assessment", "Каталожна възможност, която остава предмет на оглед и потвърждение.", "Catalogue capability that remains subject to inspection and confirmation."),
  reference("ASSESSMENT_REQUIRED", 20, "Необходима е оценка", "Assessment required", "Решение се взема след допълнителна оценка.", "Decision is made after additional assessment."),
  reference("SPECIALIST_ONLY", 30, "Само специализиран подход", "Specialist only", "Възможността е ограничена до специализирано решение.", "Capability is limited to a specialist decision."),
  reference("UNAVAILABLE", 40, "Недостъпно", "Unavailable", "Изрично недостъпна възможност в дадена връзка.", "Explicitly unavailable capability in a given relationship."),
] as const;

export type CapabilityStatusCode =
  (typeof capabilityStatuses)[number]["code"];

function serviceItemCapability(
  serviceCode: ServiceCode,
  itemTypeCode: CleaningItemTypeCode,
  statusCode: CapabilityStatusCode = "STANDARD",
) {
  return {
    serviceCode,
    itemTypeCode,
    statusCode,
    inspectionRequired: true,
    instantQuoteEligible: false,
  } as const;
}

const standardServiceItemCapabilities = [
  serviceItemCapability("CARPET_CARE", "CARPET_FIXED"),
  serviceItemCapability("RUG_RUNNER_CARE", "RUG"),
  serviceItemCapability("RUG_RUNNER_CARE", "RUNNER"),
  ...([
    "SOFA_2_SEAT",
    "SOFA_3_SEAT",
    "SOFA_4_PLUS",
    "SOFA_CORNER",
    "SOFA_U_SHAPED",
    "SOFA_BED",
    "ARMCHAIR",
    "DINING_CHAIR_UPHOLSTERED",
    "OFFICE_CHAIR_UPHOLSTERED",
    "BENCH_UPHOLSTERED",
    "OTTOMAN",
    "HEADBOARD",
  ] as const).map((itemTypeCode) =>
    serviceItemCapability("UPHOLSTERY_CARE", itemTypeCode),
  ),
  ...([
    "MATTRESS_SINGLE",
    "MATTRESS_DOUBLE",
    "MATTRESS_KING_OR_LARGE",
    "MATTRESS_CHILD",
  ] as const).map((itemTypeCode) =>
    serviceItemCapability("MATTRESS_CARE", itemTypeCode),
  ),
  serviceItemCapability("COMMERCIAL_TEXTILE_CARE", "OFFICE_CARPET"),
  serviceItemCapability(
    "COMMERCIAL_TEXTILE_CARE",
    "COMMERCIAL_UPHOLSTERY",
  ),
] as const;

export const serviceItemCapabilities = [
  ...standardServiceItemCapabilities,
  ...cleaningItemTypes.map((itemType) =>
    serviceItemCapability(
      "DELICATE_TEXTILE_ASSESSMENT",
      itemType.code,
      "SPECIALIST_ONLY",
    ),
  ),
] as const;

const normalTreatmentServiceCodes = [
  "CARPET_CARE",
  "RUG_RUNNER_CARE",
  "UPHOLSTERY_CARE",
  "MATTRESS_CARE",
  "COMMERCIAL_TEXTILE_CARE",
] as const satisfies readonly ServiceCode[];

export const serviceTreatmentLevels = [
  ...normalTreatmentServiceCodes.flatMap((serviceCode) =>
    treatmentLevels.map((treatmentLevel) => ({
      serviceCode,
      treatmentLevelCode: treatmentLevel.code,
      statusCode: "ASSESSMENT_REQUIRED" as const,
    })),
  ),
  {
    serviceCode: "DELICATE_TEXTILE_ASSESSMENT",
    treatmentLevelCode: "GENTLE_CARE",
    statusCode: "SPECIALIST_ONLY",
  },
  {
    serviceCode: "DELICATE_TEXTILE_ASSESSMENT",
    treatmentLevelCode: "SPECIALIST_ASSESSMENT",
    statusCode: "SPECIALIST_ONLY",
  },
] as const;

export const materialTreatmentConsiderations = [
  {
    materialCode: "UNKNOWN",
    treatmentLevelCode: "SPECIALIST_ASSESSMENT",
    statusCode: "ASSESSMENT_REQUIRED",
    notes: {
      bg: "Неизвестният състав изисква допълнителна оценка преди потвърждаване на обработката.",
      en: "Unknown composition requires additional assessment before treatment is confirmed.",
    },
  },
  {
    materialCode: "SILK",
    treatmentLevelCode: "SPECIALIST_ASSESSMENT",
    statusCode: "SPECIALIST_ONLY",
    notes: {
      bg: "Коприната се насочва към специализирано решение според конкретното изделие.",
      en: "Silk is routed to a specialist decision for the specific item.",
    },
  },
  {
    materialCode: "SPECIALIST_UNCERTAIN",
    treatmentLevelCode: "SPECIALIST_ASSESSMENT",
    statusCode: "SPECIALIST_ONLY",
    notes: {
      bg: "Неясният състав не допуска автоматично определяне на стандартна обработка.",
      en: "Uncertain composition does not permit automatic selection of a standard treatment.",
    },
  },
] as const satisfies readonly {
  materialCode: FibreMaterialCode;
  treatmentLevelCode: TreatmentLevelCode;
  statusCode: CapabilityStatusCode;
  notes: LocalizedText;
}[];

export const serviceAddonCapabilities = [
  ...normalTreatmentServiceCodes.flatMap((serviceCode) =>
    (["STAIN_TARGETING", "ODOUR_TREATMENT", "ADDITIONAL_EXTRACTION"] as const).map(
      (addonCode) => ({
        serviceCode,
        addonCode,
        statusCode: "ASSESSMENT_REQUIRED" as const,
      }),
    ),
  ),
  ...services.map((service) => ({
    serviceCode: service.code,
    addonCode: "DELICATE_MATERIAL_ASSESSMENT" as const,
    statusCode: "ASSESSMENT_REQUIRED" as const,
  })),
] as const;

export const publicRequestItemTypeCodes = Object.freeze(
  cleaningItemTypes.map((itemType) => itemType.code),
) as readonly [CleaningItemTypeCode, ...CleaningItemTypeCode[]];

export const publicConditionLevelCodes = Object.freeze(
  conditionLevels.map((condition) => condition.code),
) as readonly [ConditionLevelCode, ...ConditionLevelCode[]];

export function getCleaningItemType(
  code: CleaningItemTypeCode,
): (typeof cleaningItemTypes)[number] {
  const itemType = cleaningItemTypes.find((entry) => entry.code === code);
  if (!itemType) throw new Error(`Unknown cleaning item type code: ${code}`);
  return itemType;
}

export function getConditionLevel(
  code: ConditionLevelCode,
): (typeof conditionLevels)[number] {
  const condition = conditionLevels.find((entry) => entry.code === code);
  if (!condition) throw new Error(`Unknown condition level code: ${code}`);
  return condition;
}

export function getCanonicalServiceByPublicSlug(
  slug: string,
): (typeof services)[number] | undefined {
  return services.find((service) => service.publicSlug === slug);
}

export const canonicalReferenceCollections = [
  serviceCategories,
  services,
  cleaningItemTypes,
  measurementModes,
  fibreMaterials,
  surfaceConstructions,
  conditionLevels,
  issueHandlingClassifications,
  issueTypes,
  riskFlags,
  treatmentLevels,
  mechanicalActionLevels,
  treatmentApproaches,
  reuseAdvisoryCategories,
  cleaningProductCategories,
  serviceAddons,
  capabilityStatuses,
] as const satisfies readonly (readonly LocalizedReference[])[];

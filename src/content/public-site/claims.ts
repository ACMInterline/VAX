export type ClaimStatus =
  | "verified"
  | "qualified"
  | "manufacturer_evidence_required"
  | "legal_verification_required"
  | "prohibited";

export type MarketingClaim = {
  id: string;
  concept: string;
  status: ClaimStatus;
  publicationWording: { bg: string; en: string } | null;
  evidenceNeeded: string;
  notes: string;
};

export const marketingClaimRegistry = [
  {
    id: "request-submission-boundary",
    concept: "The request form persists a review request but creates no quote or booking.",
    status: "verified",
    publicationWording: {
      bg: "Формата изпраща заявка за преглед от екипа. Не се създава автоматична оферта, резервация или плащане.",
      en: "The form submits a request for staff review. It creates no automatic quote, booking or payment.",
    },
    evidenceNeeded: "Server-action, database-boundary and browser verification.",
    notes: "This is a technical fact about the current Phase 3D implementation.",
  },
  {
    id: "processing-capacity",
    concept: "A universal public processing-capacity claim.",
    status: "manufacturer_evidence_required",
    publicationWording: null,
    evidenceNeeded: "Timed field records across representative surfaces and conditions.",
    notes: "The 23 m²/hour staging assumption is internal scheduling data, not customer-facing evidence.",
  },
  {
    id: "residual-moisture",
    concept: "The method aims to limit residual moisture and support faster reuse.",
    status: "qualified",
    publicationWording: {
      bg: "Методът е насочен към ограничаване на остатъчната влага и по-бързо връщане на обработените повърхности към нормална употреба.",
      en: "The method is directed toward limiting residual moisture and returning treated surfaces to normal use sooner.",
    },
    evidenceNeeded: "Documented method plus field measurements by material and environment.",
    notes: "Drying depends on material, depth, ventilation, temperature, humidity, contamination and construction.",
  },
  {
    id: "measured-acoustic-level",
    concept: "A measured equipment sound level such as 55 dB.",
    status: "manufacturer_evidence_required",
    publicationWording: null,
    evidenceNeeded: "Exact equipment model, test standard, distance and manufacturer documentation.",
    notes: "General disturbance-reduction language may be used without a measured claim.",
  },
  {
    id: "vax-products",
    concept: "Performance or properties attributed to VAX cleaning products.",
    status: "manufacturer_evidence_required",
    publicationWording: null,
    evidenceNeeded: "Exact product identity, current technical data, safety data and publication approval.",
    notes: "Equipment use must not imply endorsement, partnership or affiliation.",
  },
  {
    id: "antibacterial-performance",
    concept: "Antibacterial effectiveness of a product or process.",
    status: "manufacturer_evidence_required",
    publicationWording: null,
    evidenceNeeded: "Product-specific efficacy evidence, method conditions and regulatory review.",
    notes: "No general antibacterial claim is published.",
  },
  {
    id: "allergen-performance",
    concept: "Specific allergen or anti-allergen performance.",
    status: "manufacturer_evidence_required",
    publicationWording: null,
    evidenceNeeded: "Product/process-specific evidence and medical-claim review.",
    notes: "General dust and residue language must not imply a health outcome.",
  },
  {
    id: "equipment-origin",
    concept: "Equipment or products are made in or imported from the United Kingdom.",
    status: "manufacturer_evidence_required",
    publicationWording: null,
    evidenceNeeded: "Model-level origin and supply-chain documentation plus approval.",
    notes: "No manufacturer affiliation or origin statement is published.",
  },
  {
    id: "legal-operating-hours",
    concept: "Bulgarian law automatically permits every cleaning operation from 06:00 to 22:00.",
    status: "legal_verification_required",
    publicationWording: null,
    evidenceNeeded: "Current legal review covering national, municipal and building-specific rules.",
    notes: "Only qualified appointment availability is published.",
  },
  {
    id: "treatment-level-methodology",
    concept: "Five levels describe treatment intensity while final selection follows inspection.",
    status: "qualified",
    publicationWording: {
      bg: "Вие описвате повърхността и проблема. Подходящата обработка се определя след професионален оглед.",
      en: "You describe the surface and concern. The appropriate treatment is determined after professional inspection.",
    },
    evidenceNeeded: "Approved operating procedure and technician training records before stronger process claims.",
    notes: "Customers do not prescribe chemistry or mechanical intensity.",
  },
  {
    id: "stain-removal",
    concept: "Stain removal depends on the stain and material and cannot be guaranteed.",
    status: "qualified",
    publicationWording: {
      bg: "Не всяко петно може да бъде отстранено безопасно. Целта е най-добрият разумно постижим резултат без излишен риск за материята.",
      en: "Not every stain can be removed safely. The aim is the best reasonably achievable result without unnecessary risk to the material.",
    },
    evidenceNeeded: "Item-specific inspection and treatment records.",
    notes: "Absolute stain-removal promises are prohibited.",
  },
  {
    id: "delicate-materials",
    concept: "Delicate or uncertain textiles may require specialist assessment or refusal.",
    status: "qualified",
    publicationWording: {
      bg: "При ценни, стари или неясни като състав текстилни изделия може да е необходима специализирана оценка, ограничен обхват или отказ от неподходяща обработка.",
      en: "Valuable, older or materially uncertain textiles may require specialist assessment, a limited scope or refusal of unsuitable treatment.",
    },
    evidenceNeeded: "Item-specific inspection and specialist referral criteria.",
    notes: "Testing reduces uncertainty but cannot remove every material risk.",
  },
  {
    id: "useful-life",
    concept: "Professional maintenance may help prolong useful life and appearance.",
    status: "qualified",
    publicationWording: {
      bg: "Професионалната поддръжка може да помогне за по-дългото запазване на добрия вид и полезния живот на мокети и мека мебел.",
      en: "Professional maintenance may help preserve the appearance and useful life of carpets and upholstered furniture for longer.",
    },
    evidenceNeeded: "Longitudinal maintenance records before any quantified comparison.",
    notes: "No quantified environmental benefit is claimed.",
  },
  {
    id: "absolute-hygiene-outcomes",
    concept: "Complete allergen, bacteria, mite or medical outcomes.",
    status: "prohibited",
    publicationWording: null,
    evidenceNeeded: "Not publishable as an absolute general service claim.",
    notes: "Includes sterilisation and guaranteed breathing, allergy or sleep outcomes.",
  },
] as const satisfies readonly MarketingClaim[];

export const publicClaimPolicy = {
  principle:
    "Publish the best reasonable, supportable explanation while avoiding guarantees that exceed the material, method or available evidence.",
  prohibitedWithoutQualification: [
    "allergen free",
    "bacteria free",
    "germ free",
    "dust-mite free",
    "sterilised",
    "guaranteed improved breathing",
    "guaranteed allergy relief",
    "guaranteed stain removal",
    "без алергени",
    "без бактерии",
    "унищожава всички акари",
    "стерилизира",
    "гарантира по-добро дишане",
    "гарантира по-добър сън",
  ],
} as const;

export const forbiddenPublishedClaimPatterns = [
  /\b(?:allergen|bacteria|germ|dust[ -]?mite)[ -]?free\b/i,
  /\bguaran[ -]?teed[ -]?(?:improved[ -]?breathing|allergy[ -]?relief|stain[ -]?removal)\b/i,
  /\b(?:100[ -]?%|completely)[ -]?removes?[ -]?(?:all[ -]?)?stains\b/i,
  /\bclini[ -]?cally[ -]?proven\b/i,
  /премахва[ -]?всички[ -]?алергени/iu,
  /антиалергично[ -]?гарантирано/iu,
  /елиминира[ -]?всички[ -]?бактерии/iu,
  /унищожава[ -]?всички[ -]?акари/iu,
  /стери[ -]?ли[ -]?зира/iu,
  /медицински[ -]?доказано/iu,
  /гарантира[ -]?по-добро[ -]?(?:дишане|сън)/iu,
  /100[ -]?%[ -]?устойчив/iu,
  /нулево[ -]?въздействие[ -]?върху[ -]?околната[ -]?среда/iu,
] as const;

export const unpublishedEvidencePatterns = [
  /\b55\s*dB\b/i,
  /\bmade[ -]?in[ -]?(?:the[ -]?)?uk\b/i,
  /\bimported[ -]?from[ -]?(?:the[ -]?)?uk\b/i,
  /\bVAX[ -]?Ltd\b/i,
  /\banti[- ]?allergen\b/i,
  /\banti[ -]?bacterial\b/i,
  /произведен[аио]?[ -]?във[ -]?Великобритания/iu,
  /внесен[аио]?[ -]?от[ -]?Великобритания/iu,
  /анти[ -]?бактериал/iu,
  /анти[ -]?алерген/iu,
] as const;

const disallowedCustomerVisibleClaimPatterns = [
  ...forbiddenPublishedClaimPatterns,
  ...unpublishedEvidencePatterns,
] as const;

const semanticPercentSignsPattern = /[\u066A\uFE6A\uFF05]/gu;
const bidirectionalControlPattern =
  /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
const semanticGapSource = "[^\\p{L}\\p{N}]*";

const latinConfusableCharacters = new Map<string, string>([
  ["Α", "A"],
  ["α", "a"],
  ["А", "A"],
  ["а", "a"],
  ["Β", "B"],
  ["β", "b"],
  ["В", "B"],
  ["в", "b"],
  ["С", "C"],
  ["с", "c"],
  ["Ԁ", "D"],
  ["ԁ", "d"],
  ["Ε", "E"],
  ["ε", "e"],
  ["Е", "E"],
  ["е", "e"],
  ["Η", "H"],
  ["η", "n"],
  ["Н", "H"],
  ["н", "h"],
  ["Ι", "I"],
  ["ι", "i"],
  ["ı", "i"],
  ["ɡ", "g"],
  ["ᴏ", "o"],
  ["І", "I"],
  ["і", "i"],
  ["Ј", "J"],
  ["ј", "j"],
  ["Κ", "K"],
  ["κ", "k"],
  ["К", "K"],
  ["к", "k"],
  ["Ӏ", "I"],
  ["ӏ", "l"],
  ["М", "M"],
  ["м", "m"],
  ["Ν", "N"],
  ["ν", "v"],
  ["Ο", "O"],
  ["ο", "o"],
  ["О", "O"],
  ["о", "o"],
  ["Ρ", "P"],
  ["ρ", "p"],
  ["Р", "P"],
  ["р", "p"],
  ["Ѕ", "S"],
  ["ѕ", "s"],
  ["Τ", "T"],
  ["τ", "t"],
  ["Т", "T"],
  ["т", "t"],
  ["Χ", "X"],
  ["χ", "x"],
  ["Х", "X"],
  ["х", "x"],
  ["Υ", "Y"],
  ["υ", "y"],
  ["У", "Y"],
  ["у", "y"],
  ["Ζ", "Z"],
  ["ζ", "z"],
]);

const cyrillicConfusableCharacters = new Map<string, string>([
  ["A", "А"],
  ["a", "а"],
  ["B", "В"],
  ["b", "в"],
  ["C", "С"],
  ["c", "с"],
  ["E", "Е"],
  ["e", "е"],
  ["H", "Н"],
  ["h", "н"],
  ["K", "К"],
  ["k", "к"],
  ["M", "М"],
  ["m", "м"],
  ["O", "О"],
  ["o", "о"],
  ["P", "Р"],
  ["p", "р"],
  ["T", "Т"],
  ["t", "т"],
  ["X", "Х"],
  ["x", "х"],
  ["Y", "У"],
  ["y", "у"],
]);

function latinConfusableComparisonView(value: string): string {
  return [...value]
    .map((character) => latinConfusableCharacters.get(character) ?? character)
    .join("");
}

function cyrillicConfusableComparisonView(value: string): string {
  return [...value]
    .map(
      (character) =>
        cyrillicConfusableCharacters.get(character) ?? character,
    )
    .join("");
}

function normalizedSemanticView(value: string): string {
  return value
    .replace(semanticPercentSignsPattern, "%")
    .normalize("NFKD")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "")
    .replace(/\p{M}/gu, "");
}

function characterScript(character: string): string {
  if (/\p{Script=Latin}/u.test(character)) return "LATIN";
  if (/\p{Script=Cyrillic}/u.test(character)) return "CYRILLIC";
  if (/\p{Script=Greek}/u.test(character)) return "GREEK";
  return "OTHER";
}

function hasMixedScriptLetterRun(value: string): boolean {
  const letterRuns = normalizedSemanticView(value).match(/\p{L}+/gu) ?? [];
  return letterRuns.some(
    (run) => new Set([...run].map(characterScript)).size > 1,
  );
}

function semanticCharacters(value: string): string[] {
  return [
    ...value
      .replace(semanticPercentSignsPattern, "%")
      .normalize("NFKD")
      .replace(/\p{Default_Ignorable_Code_Point}/gu, "")
      .replace(/\p{M}/gu, "")
      .replace(/[^\p{L}\p{N}%]/gu, ""),
  ];
}

function escapeRegExpCharacter(character: string): string {
  return character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

/**
 * Build a comparison-only pattern that tolerates punctuation, whitespace,
 * symbols and combining marks between controlled characters while retaining
 * Unicode letter/number boundaries around the complete word or phrase.
 */
function semanticPhrasePattern(
  phrase: string,
  options: { endBoundary?: boolean; startBoundary?: boolean } = {},
): RegExp {
  const characters = semanticCharacters(phrase);
  const source = characters.map(escapeRegExpCharacter).join(semanticGapSource);
  const start = options.startBoundary === false ? "" : "(?<![\\p{L}\\p{N}])";
  const end = options.endBoundary === false ? "" : "(?![\\p{L}\\p{N}])";

  return new RegExp(`${start}${source}${end}`, "iu");
}

const disallowedSemanticCustomerVisibleClaimPatterns = [
  ...[
    "allergen free",
    "bacteria free",
    "germ free",
    "dust mite free",
    "guaranteed improved breathing",
    "guaranteed allergy relief",
    "guaranteed stain removal",
    "100% remove stains",
    "100% removes stains",
    "100% remove all stains",
    "100% removes all stains",
    "completely remove stains",
    "completely removes stains",
    "completely remove all stains",
    "completely removes all stains",
    "clinically proven",
    "премахва всички алергени",
    "антиалергично гарантирано",
    "елиминира всички бактерии",
    "унищожава всички акари",
    "стерилизира",
    "медицински доказано",
    "гарантира по-добро дишане",
    "гарантира по-добър сън",
    "100% устойчив",
    "нулево въздействие върху околната среда",
    "55 dB",
    "made in UK",
    "made in the UK",
    "imported from UK",
    "imported from the UK",
    "VAX Ltd",
    "anti allergen",
    "anti bacterial",
    "произведен във Великобритания",
    "произведена във Великобритания",
    "произведено във Великобритания",
    "произведени във Великобритания",
    "внесен от Великобритания",
    "внесена от Великобритания",
    "внесено от Великобритания",
    "внесени от Великобритания",
  ].map((phrase) => semanticPhrasePattern(phrase)),
  semanticPhrasePattern("анти бактериал", { endBoundary: false }),
  semanticPhrasePattern("анти алерген", { endBoundary: false }),
] as const;

type CustomerVisibleClaimComparison = {
  hasBidirectionalControl: boolean;
  hasMixedScriptLetterRun: boolean;
  semanticViews: readonly string[];
  views: readonly string[];
};

/**
 * Claim checks use compatibility-normalized comparison views only. The caller
 * continues to return and persist the exact reviewed input.
 */
function customerVisibleClaimComparison(
  value: string,
): CustomerVisibleClaimComparison {
  const normalized = value
    .normalize("NFKC")
    .replace(semanticPercentSignsPattern, "%")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "");
  const separated = normalized
    .replace(
      /[\p{Cf}\p{P}\p{Z}\s]/gu,
      (character) => (character === "%" ? character : " "),
    )
    .replace(/ +/g, " ")
    .trim();
  const punctuationStripped = normalized
    .replace(
      /[\p{Cf}\p{P}]/gu,
      (character) => (character === "%" ? character : ""),
    )
    .replace(/[\p{Z}\s]+/gu, " ")
    .trim();
  const compatibilityStripped = [...value]
    .filter(
      (character) =>
        character.normalize("NFKD") === character.normalize("NFD"),
    )
    .join("");
  const semanticBaseViews = [
    value,
    value.replace(/\p{S}/gu, ""),
    compatibilityStripped,
    compatibilityStripped.replace(/\p{S}/gu, ""),
  ].map(normalizedSemanticView);
  const semanticViews = semanticBaseViews.flatMap((view) => [
    view,
    latinConfusableComparisonView(view),
    cyrillicConfusableComparisonView(view),
  ]);
  const confusableNormalized = latinConfusableComparisonView(
    normalizedSemanticView(normalized),
  );

  return {
    hasBidirectionalControl: bidirectionalControlPattern.test(value),
    hasMixedScriptLetterRun: hasMixedScriptLetterRun(value),
    semanticViews: [...new Set(semanticViews)],
    views: [
      ...new Set([
        normalized,
        separated,
        punctuationStripped,
        confusableNormalized,
      ]),
    ],
  };
}

function patternMatchesAnyView(
  pattern: RegExp,
  comparisonViews: readonly string[],
): boolean {
  return comparisonViews.some((view) =>
    new RegExp(pattern.source, pattern.flags).test(view),
  );
}

function canonicalClaimPatternsAllow(
  comparison: CustomerVisibleClaimComparison,
): boolean {
  return (
    !comparison.hasBidirectionalControl &&
    !comparison.hasMixedScriptLetterRun &&
    !disallowedCustomerVisibleClaimPatterns.some((pattern) =>
      patternMatchesAnyView(pattern, comparison.views),
    ) &&
    !disallowedSemanticCustomerVisibleClaimPatterns.some((pattern) =>
      patternMatchesAnyView(pattern, comparison.semanticViews),
    )
  );
}

/**
 * Applies the same reviewed claim boundary to staff-authored customer text as
 * to the public site. Allowed wording is returned unchanged by its caller.
 */
export function isCustomerVisibleClaimTextAllowed(value: string): boolean {
  return canonicalClaimPatternsAllow(customerVisibleClaimComparison(value));
}

const prohibitedCustomerVisibleQuoteClaimPattern =
  /(?:\bmed[ -]?ical(?:ly)?\b|\bmanufacturer[- ]?approved\b|\bapproved[ -]?by[ -]?(?:the[ -]?)?manufacturer\b|\bguaran[ -]?tee(?:d|s|ing)?\b|\bdisin[ -]?fect(?:s|ed|ing|ion)?\b|\bsteri[ -]?li[sz](?:e[sd]?|ing|ation)\b|меди[ -]?цин|лечеб|дезин[ -]?фек|стери[ -]?лиз|гаранти[ -]?р|одобрен[^.]{0,40}производител)/i;

const prohibitedSemanticCustomerVisibleQuoteClaimPatterns = [
  ...[
    "medical",
    "medically",
    "manufacturer approved",
    "approved by manufacturer",
    "approved by the manufacturer",
    "guarantee",
    "guaranteed",
    "guarantees",
    "guaranteeing",
    "disinfect",
    "disinfects",
    "disinfected",
    "disinfecting",
    "disinfection",
    "sterilise",
    "sterilises",
    "sterilised",
    "sterilising",
    "sterilisation",
    "sterilize",
    "sterilizes",
    "sterilized",
    "sterilizing",
    "sterilization",
  ].map((phrase) => semanticPhrasePattern(phrase)),
  semanticPhrasePattern("медицин", { endBoundary: false }),
  semanticPhrasePattern("лечеб", { endBoundary: false }),
  semanticPhrasePattern("дезинфек", { endBoundary: false }),
  semanticPhrasePattern("стерилиз", { endBoundary: false }),
  semanticPhrasePattern("гарантир", { endBoundary: false }),
] as const;

/**
 * Quote authors have a stricter boundary than reviewed stock publication copy:
 * arbitrary efficacy, approval, disinfection and guarantee language is rejected
 * in addition to every canonical public-claim restriction.
 */
export function isCustomerVisibleQuoteTextAllowed(value: string): boolean {
  const comparison = customerVisibleClaimComparison(value);
  return (
    canonicalClaimPatternsAllow(comparison) &&
    !patternMatchesAnyView(
      prohibitedCustomerVisibleQuoteClaimPattern,
      comparison.views,
    ) &&
    !prohibitedSemanticCustomerVisibleQuoteClaimPatterns.some((pattern) =>
      patternMatchesAnyView(pattern, comparison.semanticViews),
    )
  );
}

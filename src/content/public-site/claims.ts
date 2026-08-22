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
    id: "request-prototype-boundary",
    concept: "The current request form does not submit or persist information.",
    status: "verified",
    publicationWording: {
      bg: "Формата проверява въведеното само в браузъра. Не се създава заявка и нищо не се изпраща или съхранява.",
      en: "The form validates details only in the browser. No request is created and nothing is sent or stored.",
    },
    evidenceNeeded: "Repository inspection and browser verification.",
    notes: "This is a technical fact about the Phase 1A implementation.",
  },
  {
    id: "processing-capacity",
    concept: "Processing may reach approximately 25 m² per hour.",
    status: "qualified",
    publicationWording: {
      bg: "При подходящи условия професионалната обработка може да достигне около 25 m² на час, в зависимост от материята, замърсяването, избраната обработка и достъпа до повърхността.",
      en: "Under suitable conditions, professional treatment may reach approximately 25 m² per hour, depending on the material, soiling, selected treatment and access to the surface.",
    },
    evidenceNeeded: "Timed field records across representative surfaces and conditions.",
    notes: "Never present as guaranteed job duration or throughput.",
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
  /\bguaranteed (?:improved breathing|allergy relief|stain removal)\b/i,
  /\b(?:100%|completely) removes? (?:all )?stains\b/i,
  /\bclinically proven\b/i,
  /премахва всички алергени/iu,
  /антиалергично гарантирано/iu,
  /елиминира всички бактерии/iu,
  /унищожава всички акари/iu,
  /стерилизира/iu,
  /медицински доказано/iu,
  /гарантира по-добро (?:дишане|сън)/iu,
  /100% устойчив/iu,
  /нулево въздействие върху околната среда/iu,
] as const;

export const unpublishedEvidencePatterns = [
  /\b55\s*dB\b/i,
  /\bmade in (?:the )?uk\b/i,
  /\bimported from (?:the )?uk\b/i,
  /\bVAX Ltd\b/i,
  /\banti[- ]allergen\b/i,
  /\bantibacterial\b/i,
  /произведен[аио]? във Великобритания/iu,
  /внесен[аио]? от Великобритания/iu,
  /антибактериал/iu,
  /антиалерген/iu,
] as const;

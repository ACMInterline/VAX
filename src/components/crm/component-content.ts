import type { AuthLocale } from "@/auth/validation";

export const crmComponentContent = {
  bg: {
    requiredForBusiness: "Задължително за бизнес клиент.",
    choose: "Изберете",
    approximateSeatCount: "Приблизителен брой места",
    centimetres: "см",
    areaHundredths: "стотни от кв. м",
    canonicalReferencesHint:
      "Изберете само известните стойности. Оставете празно, когато няма надеждна информация.",
    reportedIssuesHint: "Изберете всички проблеми, заявени от клиента.",
    reportedRisksHint: "Изберете всички заявени рискови фактори.",
  },
  en: {
    requiredForBusiness: "Required for a business customer.",
    choose: "Choose",
    approximateSeatCount: "Approximate seat count",
    centimetres: "cm",
    areaHundredths: "hundredths of a square metre",
    canonicalReferencesHint:
      "Select only known values. Leave a field empty when the information is not reliable.",
    reportedIssuesHint: "Select every issue reported by the customer.",
    reportedRisksHint: "Select every reported risk flag.",
  },
} as const satisfies Record<
  AuthLocale,
  {
    requiredForBusiness: string;
    choose: string;
    approximateSeatCount: string;
    centimetres: string;
    areaHundredths: string;
    canonicalReferencesHint: string;
    reportedIssuesHint: string;
    reportedRisksHint: string;
  }
>;

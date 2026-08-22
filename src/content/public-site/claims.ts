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
  ],
  evidenceReviewRequired: [
    "Named antibacterial product performance",
    "Named anti-allergen product performance",
    "Manufacturer-specific product claims",
    "Measured noise or acoustic performance",
    "Fixed drying or return-to-use times",
    "Environmental or sustainability comparisons",
  ],
} as const;

export const forbiddenPublishedClaimPatterns = [
  /\b(?:allergen|bacteria|germ|dust[ -]?mite)[ -]?free\b/i,
  /\bguaranteed (?:improved breathing|allergy relief|stain removal)\b/i,
  /\b(?:100%|completely) removes? (?:all )?stains\b/i,
  /\bclinically proven\b/i,
] as const;

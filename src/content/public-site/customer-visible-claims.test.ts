import { describe, expect, it } from "vitest";
import {
  forbiddenPublishedClaimPatterns,
  isCustomerVisibleClaimTextAllowed,
  isCustomerVisibleQuoteTextAllowed,
  marketingClaimRegistry,
  unpublishedEvidencePatterns,
} from "./claims";

const forbiddenClaimExamples = [
  "Our service leaves carpets allergen-free.",
  "We guarantee guaranteed stain removal.",
  "The process completely removes all stains.",
  "This method is clinically proven.",
  "Услугата премахва всички алергени.",
  "Почистването е антиалергично гарантирано.",
  "Процесът елиминира всички бактерии.",
  "Услугата унищожава всички акари.",
  "Методът стерилизира тъканите.",
  "Това е медицински доказано.",
  "Услугата гарантира по-добро дишане.",
  "Процесът е 100% устойчив.",
  "Услугата има нулево въздействие върху околната среда.",
] as const;

const unpublishedEvidenceExamples = [
  "The measured sound level is 55 dB.",
  "The equipment is made in the UK.",
  "The product is imported from the UK.",
  "This treatment is approved by VAX Ltd.",
  "The service uses an anti-allergen treatment.",
  "The treatment is antibacterial.",
  "Уредът е произведен във Великобритания.",
  "Продуктът е внесен от Великобритания.",
  "Предлагаме антибактериална обработка.",
  "Предлагаме антиалергенна обработка.",
] as const;

const separatorVariantExamples = [
  ["spaced English antibacterial wording", "The treatment is anti bacterial."],
  ["hyphenated English antibacterial wording", "The treatment is anti-bacterial."],
  ["punctuated English antibacterial wording", "The treatment is anti.bacterial."],
  ["zero-width English antibacterial wording", "The treatment is anti\u200Bbacterial."],
  ["compatibility-normalized English antibacterial wording", "The treatment is ａｎｔｉｂａｃｔｅｒｉａｌ."],
  ["spaced Bulgarian antibacterial wording", "Предлагаме анти бактериална обработка."],
  ["hyphenated Bulgarian antibacterial wording", "Предлагаме анти-бактериална обработка."],
  ["punctuated Bulgarian antibacterial wording", "Предлагаме анти.бактериална обработка."],
  ["zero-width Bulgarian antibacterial wording", "Предлагаме анти\u200Bбактериална обработка."],
  ["hyphenated clinical wording", "This method is clinically-proven."],
  ["punctuated clinical wording", "This method is clinically.proven."],
  ["zero-width clinical wording", "This method is clinically\u200Bproven."],
  ["mixed-separator clinical wording", "This method is clini\u200Bcally-proven."],
  ["hyphenated origin wording", "The equipment is made-in-the-UK."],
  ["punctuated origin wording", "The equipment is made.in.the.UK."],
  ["zero-width origin wording", "The equipment is made\u200Bin\u200Bthe\u200BUK."],
  ["mixed-separator origin wording", "The equipment is ma\u200Bde-in.the-UK."],
  ["spaced Bulgarian sterilization wording", "Методът стери лизира тъканите."],
  ["hyphenated Bulgarian sterilization wording", "Методът стери-лизира тъканите."],
  ["punctuated Bulgarian sterilization wording", "Методът стери.лизира тъканите."],
  ["zero-width Bulgarian sterilization wording", "Методът стери\u200Bлизира тъканите."],
  ["mixed-separator Bulgarian sterilization wording", "Методът сте\u200Bри-ли зира тъканите."],
  ["mixed-separator absolute stain wording", "The process completely.removes-all-stains."],
  ["compatibility and separator percent wording", "Процесът е １００ %\u200B устой-чив."],
  ["default-ignorable English antibacterial wording", "The treatment is anti\u034Fbacterial."],
  ["variation-selector percent wording", "Процесът е 100%\uFE0F устойчив."],
  ["Arabic-percent Bulgarian wording", "Процесът е 100\u066A устойчив."],
  ["intraword narrow-space clinical wording", "This method is clin\u202Fically pro\u202Fven."],
  ["intraword narrow-space Bulgarian guarantee wording", "Услугата га\u202Fран\u202Fтира по-добро дишане."],
] as const;

const separatorVariantQuoteOnlyExamples = [
  ["spaced guarantee wording", "The result is guaran teed."],
  ["hyphenated sterilization wording", "The service includes steri-lization."],
  ["punctuated manufacturer approval wording", "Manufacturer.approved treatment."],
  ["zero-width disinfection wording", "The service includes disin\u200Bfection."],
  ["punctuated Bulgarian guarantee wording", "Резултатът е гаранти.ран."],
  ["compatibility-normalized medical wording", "The service is ｍｅｄｉｃａｌ."],
  ["mixed-separator guarantee wording", "The result is guar-an teed."],
  ["intraword narrow-space guarantee wording", "The result is guar\u202Fanteed."],
  ["intraword narrow-space medical wording", "The service is me\u202Fdic\u202Fal."],
  ["intraword narrow-space disinfection wording", "The service includes di\u202Fsinfection."],
  ["mixed ordinary and narrow-space antibacterial wording", "The treatment is anti bacte\u202Frial."],
] as const;

const confusableQuoteOnlyExamples = [
  ["mixed-script medical wording", "The service is med\u0456cal."],
  [
    "mixed-script manufacturer approval wording",
    "Manufacturer appr\u043Eved treatment.",
  ],
  ["mixed-script guarantee wording", "The result is guarant\u0435ed."],
  ["Greek-confusable medical wording", "The service is med\u03B9cal."],
  [
    "Greek-confusable manufacturer approval wording",
    "Manufacturer appr\u03BFved treatment.",
  ],
  ["Greek-confusable guarantee wording", "The result is guarant\u03B5ed."],
  [
    "reverse-script Bulgarian guarantee wording",
    "Резултатът е гaрантиран.",
  ],
  [
    "reverse-script Bulgarian medical wording",
    "Това е мeдицинско твърдение.",
  ],
  [
    "reverse-script Bulgarian sterilization wording",
    "Услугата cтерилизира тъканите.",
  ],
  ["precomposed Greek medical wording", "The service is med\u03AFcal."],
  [
    "precomposed Greek manufacturer approval wording",
    "Manufacturer appr\u03CCved treatment.",
  ],
  ["precomposed Greek guarantee wording", "The result is guarant\u03ADed."],
  ["dotless-i medical wording", "The service is med\u0131cal."],
  ["script-g guarantee wording", "The result is \u0261uaranteed."],
  [
    "small-cap-o manufacturer approval wording",
    "Manufacturer appr\u1D0Fved treatment.",
  ],
] as const;

const lexicalQuoteOnlyExamples = [
  ["inflected guarantee wording", "Our service guarantees complete removal."],
  [
    "reordered manufacturer approval wording",
    "This treatment is approved by the manufacturer.",
  ],
  ["adverbial medical wording", "This treatment is medically proven."],
  ["inflected disinfection wording", "This process disinfects carpets."],
] as const;

const bidirectionalControlCharacters = [
  "\u061C",
  "\u200E",
  "\u200F",
  "\u202A",
  "\u202B",
  "\u202C",
  "\u202D",
  "\u202E",
  "\u2066",
  "\u2067",
  "\u2068",
  "\u2069",
] as const;

const everyBoundaryClaimExamples = [
  {
    policy: "canonical",
    text: (word: string) => `The treatment is ${word}.`,
    word: "antibacterial",
  },
  {
    policy: "canonical",
    text: (word: string) => `This method is ${word} proven.`,
    word: "clinically",
  },
  {
    policy: "canonical",
    text: (word: string) => `Методът ${word} тъканите.`,
    word: "стерилизира",
  },
  {
    policy: "canonical",
    text: (word: string) => `Услугата ${word} по-добро дишане.`,
    word: "гарантира",
  },
  {
    policy: "quote",
    text: (word: string) => `The service is ${word}.`,
    word: "medical",
  },
  {
    policy: "quote",
    text: (word: string) => `The result is ${word}.`,
    word: "guaranteed",
  },
  {
    policy: "quote",
    text: (word: string) => `The service includes ${word}.`,
    word: "disinfection",
  },
  {
    policy: "quote",
    text: (word: string) => `The service includes ${word}.`,
    word: "sterilization",
  },
] as const;

const comparisonSeparators = [
  " ",
  "\u202F",
  "\u034F",
  "\uFE0F",
  "\u0301",
  ".",
  "★",
  "™",
  "℠",
  "%",
  "٪",
  "①",
  "²",
  "Ⅳ",
  "ʰ",
  "ﬀ",
] as const;

describe("customer-visible claim policy", () => {
  it("rejects every prohibited public-claim pattern", () => {
    expect(forbiddenClaimExamples).toHaveLength(
      forbiddenPublishedClaimPatterns.length,
    );

    forbiddenPublishedClaimPatterns.forEach((pattern, index) => {
      const example = forbiddenClaimExamples[index];
      expect(example).toMatch(pattern);
      expect(isCustomerVisibleClaimTextAllowed(example)).toBe(false);
    });
  });

  it("rejects every claim that requires unpublished evidence", () => {
    expect(unpublishedEvidenceExamples).toHaveLength(
      unpublishedEvidencePatterns.length,
    );

    unpublishedEvidencePatterns.forEach((pattern, index) => {
      const example = unpublishedEvidenceExamples[index];
      expect(example).toMatch(pattern);
      expect(isCustomerVisibleClaimTextAllowed(example)).toBe(false);
    });
  });

  it.each(separatorVariantExamples)(
    "rejects %s through both customer-visible claim boundaries",
    (_label, example) => {
      expect(isCustomerVisibleClaimTextAllowed(example)).toBe(false);
      expect(isCustomerVisibleQuoteTextAllowed(example)).toBe(false);
    },
  );

  it.each(separatorVariantQuoteOnlyExamples)(
    "rejects %s through the stricter quote boundary",
    (_label, example) => {
      expect(isCustomerVisibleQuoteTextAllowed(example)).toBe(false);
    },
  );

  it.each(confusableQuoteOnlyExamples)(
    "rejects %s through the stricter quote boundary",
    (_label, example) => {
      expect(isCustomerVisibleQuoteTextAllowed(example)).toBe(false);
    },
  );

  it.each(lexicalQuoteOnlyExamples)(
    "rejects %s through the stricter quote boundary",
    (_label, example) => {
      expect(isCustomerVisibleQuoteTextAllowed(example)).toBe(false);
    },
  );

  it.each(bidirectionalControlCharacters)(
    "rejects customer-visible quote text containing bidi control U+%s",
    (control) => {
      expect(
        isCustomerVisibleQuoteTextAllowed(
          `Access${control} remains subject to confirmation.`,
        ),
      ).toBe(false);
    },
  );

  it("rejects separator insertion at every interior position of controlled words", () => {
    for (const example of everyBoundaryClaimExamples) {
      for (const separator of comparisonSeparators) {
        for (let index = 1; index < example.word.length; index += 1) {
          const variant = example.text(
            `${example.word.slice(0, index)}${separator}${example.word.slice(index)}`,
          );

          if (example.policy === "canonical") {
            expect(isCustomerVisibleClaimTextAllowed(variant)).toBe(false);
          }
          expect(isCustomerVisibleQuoteTextAllowed(variant)).toBe(false);
        }
      }
    }
  });

  it("keeps repeated comparison checks independent of RegExp state", () => {
    const prohibited = "The treatment is anti-bacterial.";
    const ordinary = "Access remains subject to confirmation.";

    expect(isCustomerVisibleQuoteTextAllowed(prohibited)).toBe(false);
    expect(isCustomerVisibleQuoteTextAllowed(ordinary)).toBe(true);
    expect(isCustomerVisibleQuoteTextAllowed(prohibited)).toBe(false);
  });

  it("keeps bounded numeric near-misses linear-time", () => {
    const startedAt = performance.now();
    expect(
      isCustomerVisibleQuoteTextAllowed(`1${"0".repeat(1_999)}`),
    ).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });

  it("preserves ordinary customer-visible wording", () => {
    expect(
      isCustomerVisibleClaimTextAllowed(
        "Staff will review the request before any quote is issued.",
      ),
    ).toBe(true);
    expect(
      isCustomerVisibleClaimTextAllowed(
        "Екипът ще прегледа заявката преди издаване на оферта.",
      ),
    ).toBe(true);
    expect(
      isCustomerVisibleQuoteTextAllowed(
        "Access, parking, and lift use remain subject to confirmation.",
      ),
    ).toBe(true);
    expect(
      isCustomerVisibleQuoteTextAllowed(
        "Достъпът, паркирането и асансьорът подлежат на потвърждение.",
      ),
    ).toBe(true);
    expect(
      isCustomerVisibleQuoteTextAllowed(
        "The medic alerted staff to the access restriction.",
      ),
    ).toBe(true);
    expect(
      isCustomerVisibleQuoteTextAllowed(
        "Reference 155-DB remains pending review.",
      ),
    ).toBe(true);
    expect(
      isCustomerVisibleQuoteTextAllowed(
        "Reference 2medical2 remains pending review.",
      ),
    ).toBe(true);
    expect(
      isCustomerVisibleQuoteTextAllowed(
        "Почистване с VAX след професионален оглед.",
      ),
    ).toBe(true);
    expect(
      isCustomerVisibleQuoteTextAllowed(
        "Access in София remains subject to confirmation.",
      ),
    ).toBe(true);
  });

  it("preserves every reviewed stock wording that is approved for publication", () => {
    for (const claim of marketingClaimRegistry) {
      if (!claim.publicationWording) continue;

      expect(isCustomerVisibleClaimTextAllowed(claim.publicationWording.bg)).toBe(
        true,
      );
      expect(isCustomerVisibleClaimTextAllowed(claim.publicationWording.en)).toBe(
        true,
      );
    }
  });

  it("keeps staff-authored quote wording behind the stricter existing boundary", () => {
    expect(
      isCustomerVisibleQuoteTextAllowed(
        "Manufacturer-approved medical disinfection is guaranteed.",
      ),
    ).toBe(false);
    expect(
      isCustomerVisibleQuoteTextAllowed(
        "Access and parking remain subject to confirmation.",
      ),
    ).toBe(true);
  });
});

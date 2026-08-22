import type { FrequentlyAskedQuestion } from "@/content/public-site/types";

export function FaqList({
  faqs,
  limit,
}: {
  faqs: readonly FrequentlyAskedQuestion[];
  limit?: number;
}) {
  const visibleFaqs = typeof limit === "number" ? faqs.slice(0, limit) : faqs;

  return (
    <div className="faq-list">
      {visibleFaqs.map((faq, index) => (
        <details key={faq.question} open={index === 0}>
          <summary>
            <span>{faq.question}</span>
            <span className="faq-list__icon" aria-hidden="true" />
          </summary>
          <div className="faq-list__answer">
            <p>{faq.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

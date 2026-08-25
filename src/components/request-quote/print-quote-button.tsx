"use client";

export function PrintQuoteButton({ label }: { label: string }) {
  return (
    <button className="crm-button" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}

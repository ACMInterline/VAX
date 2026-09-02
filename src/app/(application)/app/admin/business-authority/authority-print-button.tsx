"use client";

export function AuthorityPrintButton({ label }: { label: string }) {
  return (
    <button
      className="crm-button business-authority-screen-only"
      type="button"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}

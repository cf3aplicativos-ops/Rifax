"use client";

export default function PrintButton({ label = "Imprimir recibo" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
    >
      🖨️ {label}
    </button>
  );
}

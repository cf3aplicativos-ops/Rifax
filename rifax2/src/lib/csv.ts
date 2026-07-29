// Generación de CSV (compatible con Excel: BOM UTF-8 + separador ;).
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))];
  return "﻿" + lineas.join("\r\n");
}

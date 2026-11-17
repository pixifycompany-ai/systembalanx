// Números digitados no formato brasileiro.

/** "1.500,50" | "1500,5" | "12.5" → "1500.50" | "1500.5" | "12.5" (ponto decimal). */
export function paraPontoDecimal(raw: string): string {
  let s = raw.replace(/[^\d,.-]/g, "");
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(/,/g, (m, i, str) => (i === str.lastIndexOf(",") ? "." : ""));
  else {
    const ultimo = s.lastIndexOf(".");
    if (ultimo !== -1) s = s.slice(0, ultimo).replace(/\./g, "") + s.slice(ultimo);
  }
  return (neg ? "-" : "") + s;
}

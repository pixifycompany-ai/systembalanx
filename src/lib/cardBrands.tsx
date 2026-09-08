// Marcas de bandeira — recriações leves (troque pelos SVGs oficiais se quiser).
// 'mono' = herda a cor (contraste automático); 'color' = cores próprias em plaquinha de vidro.
import { cn } from '@/lib/utils';

export type BrandType = 'mono' | 'color' | 'none';

export interface Brand {
  key: string;
  name: string;
  type: BrandType;
  svg: string;
}

export const BRANDS: Brand[] = [
  { key: 'visa', name: 'Visa', type: 'mono',
    svg: '<svg viewBox="0 0 48 16"><text x="0" y="13.5" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-style="italic" font-size="15" letter-spacing="1" fill="currentColor">VISA</text></svg>' },
  { key: 'mastercard', name: 'Mastercard', type: 'color',
    svg: '<svg viewBox="0 0 46 28"><circle cx="17" cy="14" r="13" fill="#EB001B"/><circle cx="29" cy="14" r="13" fill="#F79E1B"/><path d="M23 4.2a13 13 0 000 19.6 13 13 0 000-19.6z" fill="#FF5F00"/></svg>' },
  { key: 'elo', name: 'Elo', type: 'color',
    svg: '<svg viewBox="0 0 60 26"><circle cx="9" cy="8" r="5" fill="#FFCB05"/><circle cx="9" cy="18" r="5" fill="#00A4E0"/><circle cx="17.5" cy="13" r="5" fill="#EF4123"/><text x="26" y="19" font-family="Arial" font-weight="800" font-size="17" fill="#333">elo</text></svg>' },
  { key: 'amex', name: 'American Express', type: 'mono',
    svg: '<svg viewBox="0 0 64 16"><text x="0" y="13" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="13" letter-spacing="1" fill="currentColor">AMEX</text></svg>' },
  { key: 'hipercard', name: 'Hipercard', type: 'mono',
    svg: '<svg viewBox="0 0 96 16"><text x="0" y="13" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-style="italic" font-size="14" fill="currentColor">Hipercard</text></svg>' },
  { key: 'diners', name: 'Diners', type: 'mono',
    svg: '<svg viewBox="0 0 74 18"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 3a6 6 0 010 12z" fill="currentColor"/><text x="22" y="13" font-family="Arial" font-weight="700" font-size="12" fill="currentColor">Diners</text></svg>' },
];

export function brandByName(name?: string | null): Brand | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return BRANDS.find((b) => b.name.toLowerCase() === n || b.key === n) || null;
}

/** Luminância relativa de um hex (#rrggbb) — usado pro contraste automático. */
export function luminance(hex: string): number {
  const h = (hex || '#000').replace('#', '');
  if (h.length < 6) return 0;
  const r = parseInt(h.substr(0, 2), 16) / 255;
  const g = parseInt(h.substr(2, 2), 16) / 255;
  const b = parseInt(h.substr(4, 2), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cor de contraste para logos monocromáticas sobre um fundo `bg`. */
export function contrastInk(bg: string): string {
  return luminance(bg) > 0.6 ? '#10233b' : '#ffffff';
}

/** Renderiza a logo da bandeira com contraste. `bg` = cor de fundo do cartão. */
export function BrandMark({ brand, bg, height = 20, className }: { brand: Brand; bg: string; height?: number; className?: string }) {
  if (brand.type === 'color') {
    // plaquinha de vidro pra preservar as cores oficiais
    return (
      <span
        className={cn('inline-flex items-center rounded-md bg-white/90 px-1.5 py-1 shadow-sm', className)}
        style={{ height: height + 8 }}
        dangerouslySetInnerHTML={{ __html: brand.svg.replace('<svg', `<svg height="${height}" width="auto"`) }}
      />
    );
  }
  return (
    <span
      className={cn('inline-flex items-center', className)}
      style={{ color: contrastInk(bg), height }}
      dangerouslySetInnerHTML={{ __html: brand.svg.replace('<svg', `<svg height="${height}" width="auto"`) }}
    />
  );
}

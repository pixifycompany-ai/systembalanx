// Superfície de destaque BALANX: navy liso, só uma luz sutil no topo (sem glow).
// Navy no claro; no escuro um tom acima do card (--navy-card) pra não sumir no fundo.
export const NAVY_SURFACE_BG = 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 45%), hsl(var(--navy-card))';
export const NAVY_SURFACE_SHADOW = 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 36px -24px rgba(11,18,38,0.55)';

// Cores de status legíveis sobre o navy (os tokens do tema claro são escuros demais aqui).
export const NAVY_TONE = {
  success: '#3ECF8E',
  danger: '#FF7A70',
  warning: '#F2B544',
} as const;

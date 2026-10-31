// Tema dos gráficos recharts das telas de análise (tokens do tema, claro e escuro).

import type { CSSProperties } from 'react';

/** Cores das séries (tokens do tema — funcionam no claro e no escuro). */
export const CHART = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--foreground) / 0.35)',
  ink: 'hsl(var(--foreground))',
  danger: 'hsl(var(--danger))',
  success: 'hsl(var(--success))',
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--foreground-muted))',
} as const;

/** Eixos discretos: sem linha nem tracinho, rótulo 11px cinza. */
export const axisProps = {
  stroke: CHART.axis,
  tick: { fontSize: 11, fill: CHART.axis },
  tickLine: false,
  axisLine: false,
};

/** Grade só horizontal, tracejada, na cor da borda. */
export const gridProps = {
  strokeDasharray: '3 3',
  stroke: CHART.grid,
  vertical: false,
};

const tooltipContent: CSSProperties = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 14,
  fontSize: 12,
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 8px 24px -12px hsl(var(--foreground) / 0.25)',
  padding: '8px 12px',
};

/** Tooltip do recharts em bg-popover/border-border (nunca branco fixo). */
export const tooltipProps = {
  contentStyle: tooltipContent,
  labelStyle: { color: 'hsl(var(--popover-foreground))', fontWeight: 600, marginBottom: 2 } as CSSProperties,
  itemStyle: { color: 'hsl(var(--popover-foreground))' } as CSSProperties,
};

/** Realce suave da coluna sob o cursor em gráficos de barra. */
export const barCursor = { fill: 'hsl(var(--foreground) / 0.04)' };

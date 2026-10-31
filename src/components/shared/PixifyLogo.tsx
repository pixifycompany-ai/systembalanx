import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import iso from '@/assets/brand/logo_isotipo.svg';

interface PixifyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Show only the app-icon squircle, without the "balanx" wordmark. */
  iconOnly?: boolean;
}

const sizeClasses = {
  sm: { box: 'h-6 w-6 rounded-[7px]', iso: 'h-[15px]', text: 'text-base' },   // Header
  md: { box: 'h-9 w-9 rounded-[10px]', iso: 'h-[22px]', text: 'text-xl' },    // Default
  lg: { box: 'h-14 w-14 rounded-[16px]', iso: 'h-[34px]', text: 'text-3xl' }, // Login
};

// Fundo do ícone BALANX (AURO azul): navy + glow azul + azul profundo embaixo.
// Mesmo gradiente do favicon/ícones do PWA (public/favicon.svg).
export const AURO_ICON_BG =
  'radial-gradient(85% 85% at 24% 20%, rgba(74,138,224,0.95), transparent 60%), radial-gradient(75% 75% at 50% 105%, rgba(37,99,235,0.55), transparent 100%), #0B1226';

const AURO_SQUIRCLE: CSSProperties = {
  background: AURO_ICON_BG,
  boxShadow: '0 8px 20px -6px rgba(60,120,210,0.5), inset 0 1px 0 rgba(255,255,255,0.14)',
};

export function PixifyLogo({ size = 'md', className, iconOnly = false }: PixifyLogoProps) {
  const s = sizeClasses[size];

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className={cn('inline-grid place-items-center shrink-0', s.box)} style={AURO_SQUIRCLE}>
        <img src={iso} alt="balanx" className={cn('w-auto', s.iso)} />
      </span>
      {!iconOnly && (
        <span
          className={cn('lowercase text-foreground leading-none font-semibold tracking-tight', s.text)}
        >
          balanx
        </span>
      )}
    </span>
  );
}

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
  sm: { box: 'h-6 w-6 rounded-[7px]', iso: 'h-[13px]', text: 'text-base' },   // Header
  md: { box: 'h-9 w-9 rounded-[10px]', iso: 'h-[19px]', text: 'text-xl' },    // Default
  lg: { box: 'h-14 w-14 rounded-[16px]', iso: 'h-[30px]', text: 'text-3xl' }, // Login
};

// App-icon AURO: isotipo sobre o squircle com gradiente (igual ao mockup aprovado)
const AURO_SQUIRCLE: CSSProperties = {
  background:
    'radial-gradient(120% 92% at 20% 8%, rgba(58,120,205,0.98), transparent 56%), radial-gradient(120% 90% at 92% 16%, rgba(216,152,70,0.72), transparent 50%), #0a1120',
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

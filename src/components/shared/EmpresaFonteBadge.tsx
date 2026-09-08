import { cn } from '@/lib/utils';

export type EmpresaFonte = 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO';

export const EMPRESA_FONTE_OPTIONS: { value: EmpresaFonte; label: string }[] = [
  { value: 'PIXIFY', label: 'PIXIFY' },
  { value: 'REVVUE', label: 'REVVUE' },
  { value: 'CLARIO', label: 'CLARIO' },
  { value: 'TABELIO', label: 'TABELIO' },
];

const BRAND_TOKEN: Record<EmpresaFonte, string> = {
  PIXIFY: 'var(--brand-pixify)',
  REVVUE: 'var(--brand-revvue)',
  CLARIO: 'var(--brand-clario)',
  TABELIO: 'var(--brand-tabelio)',
};

interface EmpresaFonteBadgeProps {
  empresa?: EmpresaFonte | null;
  size?: 'xs' | 'sm';
  className?: string;
}

export function EmpresaFonteBadge({ empresa, size = 'xs', className }: EmpresaFonteBadgeProps) {
  if (!empresa) return null;
  const color = BRAND_TOKEN[empresa];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium tracking-wide',
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        className
      )}
      style={{
        color: `hsl(${color})`,
        borderColor: `hsl(${color} / 0.3)`,
        backgroundColor: `hsl(${color} / 0.08)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `hsl(${color})` }}
      />
      {empresa}
    </span>
  );
}

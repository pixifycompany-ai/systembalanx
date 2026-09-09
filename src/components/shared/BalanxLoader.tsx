import { cn } from '@/lib/utils';
import iso from '@/assets/brand/logo_isotipo.svg';

/** Anel-cometa premium — spinner inline com o isotipo AURO. */
export function CometSpinner({ size = 52, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <span className="balanx-cring" />
    </span>
  );
}

/** Tela cheia de carregamento (isotipo + glow + anel-cometa), igual ao mockup. */
export function BalanxLoader({ message = 'Carregando seu financeiro…' }: { message?: string }) {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Glow ambiente AURO (igual mockup) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 42% at 18% 8%, hsl(var(--primary) / 0.42), transparent 70%), radial-gradient(55% 38% at 88% 4%, hsl(38 82% 55% / 0.30), transparent 68%), radial-gradient(70% 45% at 50% 108%, hsl(var(--primary) / 0.28), transparent 72%)',
        }}
      />
      <div className="relative z-[1] grid place-items-center" style={{ width: 120, height: 120 }}>
        <div
          className="absolute rounded-full"
          style={{
            inset: 14,
            background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.35), transparent 72%)',
            filter: 'blur(4px)',
          }}
        />
        <span className="balanx-cring" />
        <img
          src={iso}
          alt="balanx"
          className="relative z-[2] w-auto"
          style={{ height: 46, filter: 'drop-shadow(0 6px 20px hsl(var(--primary) / 0.35))' }}
        />
      </div>
      <p className="absolute bottom-20 z-[1] text-xs font-medium text-foreground-muted tracking-wide">{message}</p>
    </div>
  );
}

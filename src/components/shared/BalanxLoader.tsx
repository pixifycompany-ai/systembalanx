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
export function BalanxLoader({ message = 'Carregando' }: { message?: string }) {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background relative">
      <div className="relative grid place-items-center" style={{ width: 120, height: 120 }}>
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
      <p className="absolute bottom-20 text-xs font-medium text-foreground-muted tracking-wide">{message}</p>
    </div>
  );
}

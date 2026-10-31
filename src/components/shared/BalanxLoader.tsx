import { cn } from '@/lib/utils';
import iso from '@/assets/brand/logo_isotipo.svg';
import { AURO_ICON_BG } from '@/components/shared/PixifyLogo';

/** Anel-cometa premium — spinner inline com o isotipo AURO. */
export function CometSpinner({ size = 52, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <span className="balanx-cring" />
    </span>
  );
}

/**
 * Carregamento com isotipo + anel-cometa.
 * - fullscreen (padrão): cobre o viewport com bg opaco + glow próprio (splash/rotas).
 * - fullscreen=false: transparente e sem retângulo, pra usar DENTRO do app (ex.:
 *   MeuPerfil, dentro do AppLayout) — assim o glow do body aparece e não fica o
 *   "quadrado" recortado pelo padding do <main>.
 */
export function BalanxLoader({
  message = 'Carregando seu financeiro…',
  fullscreen = true,
}: {
  message?: string;
  fullscreen?: boolean;
}) {
  return (
    <div
      className={cn(
        'w-full flex flex-col items-center justify-center relative overflow-hidden',
        // fixed inset-0 preenche a viewport inteira (inclusive sob a status bar
        // no PWA black-translucent) — sem depender do dvh, que falha em alguns
        // browsers e deixa uma faixa sem fundo no rodapé.
        // .h-lvh cobre a viewport GRANDE (100lvh, fallback 100vh) igual ao
        // body::before — sem faixa/limite no rodapé quando a barra do Safari
        // aparece/some.
        fullscreen ? 'fixed top-0 left-0 right-0 h-lvh z-50 bg-background' : 'min-h-[60vh]',
      )}
      // Safe-area no conteúdo pra não encostar na status bar / home indicator.
      style={fullscreen ? { paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : undefined}
    >
      {/* Glow ambiente AURO — só no modo tela cheia (inline usa o glow do body) */}
      {fullscreen && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 42% at 18% 8%, hsl(var(--primary) / 0.42), transparent 70%), radial-gradient(55% 38% at 88% 4%, rgba(37,99,235,0.30), transparent 68%), radial-gradient(70% 45% at 50% 108%, hsl(var(--primary) / 0.28), transparent 72%)',
          }}
        />
      )}
      <div className="relative z-[1] grid place-items-center" style={{ width: 120, height: 120 }}>
        <div
          className="absolute rounded-full"
          style={{
            inset: 10,
            background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.35), transparent 72%)',
            filter: 'blur(6px)',
          }}
        />
        <span className="balanx-cring" />
        {/* Ícone do app (squircle AURO + hexágono): legível no tema claro e no escuro */}
        <span
          className="relative z-[2] grid place-items-center rounded-[18px]"
          style={{
            width: 64,
            height: 64,
            background: AURO_ICON_BG,
            boxShadow: '0 10px 26px -8px rgba(37,99,235,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
          }}
        >
          <img src={iso} alt="balanx" className="w-auto" style={{ height: 38 }} />
        </span>
      </div>
      <p className={cn(
        'z-[1] text-xs font-medium text-foreground-muted tracking-wide',
        fullscreen ? 'absolute bottom-20' : 'mt-6',
      )}>{message}</p>
    </div>
  );
}

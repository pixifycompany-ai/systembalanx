import type { ReactNode } from 'react';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
import loginPhoto from '@/assets/brand/login-personagem.webp';

interface AuthShellProps {
  /** Manchete sobre a foto (ex.: "Seu financeiro, no bolso."). */
  title: ReactNode;
  children: ReactNode;
}

/**
 * Moldura das telas de autenticação: foto do personagem em tela cheia,
 * manchete em branco e o formulário num cartão liso (cores do tema).
 * Desktop: conteúdo à esquerda (o personagem fica à direita da foto).
 * Mobile: foto numa faixa no topo, título e cartão logo abaixo (em fluxo).
 */
export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#070B14] md:overflow-hidden">
      {/* Foto: faixa no topo (mobile) / tela cheia (desktop). No mobile o conteúdo vem
          DEPOIS da foto, em fluxo normal — formulário maior nunca cobre o rosto. */}
      <div className="relative h-[34vh] min-h-[220px] md:absolute md:inset-0 md:h-auto">
        <img
          src={loginPhoto}
          alt="Empreendedor sorrindo para a câmera com o celular na mão numa avenida ao entardecer"
          className="h-full w-full object-cover object-[56%_18%] md:object-[30%_center]"
        />
        <div
          aria-hidden
          className="absolute inset-0 md:hidden"
          style={{ background: 'linear-gradient(180deg, rgba(7,11,20,0.35), rgba(7,11,20,0) 30%, rgba(7,11,20,0.15) 60%, #070B14 100%)' }}
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block"
          style={{ background: 'linear-gradient(90deg, rgba(7,11,20,0.92) 0%, rgba(7,11,20,0.65) 32%, rgba(7,11,20,0) 55%)' }}
        />
        <PixifyLogo size="md" className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] md:hidden [&_span:last-child]:text-white" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-8 md:mx-0 md:flex md:min-h-[100dvh] md:max-w-none md:items-center md:px-[clamp(32px,6vw,96px)] md:py-12">
        <div className="-mt-6 flex w-full flex-col gap-5 md:mt-0 md:max-w-[420px] md:gap-7">
          <PixifyLogo size="md" className="hidden md:flex [&_span:last-child]:text-white" />
          <h1 className="text-[30px] font-semibold leading-[1.06] tracking-[-0.035em] text-white md:text-[clamp(36px,4.4vw,54px)] [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">
            {title}
          </h1>
          <div className="rounded-[26px] border border-border bg-surface p-5 text-foreground shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] md:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

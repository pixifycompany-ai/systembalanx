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
 * Mobile: foto na metade de cima, cartão ancorado embaixo.
 */
export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#070B14]">
      <img
        src={loginPhoto}
        alt="Empreendedor sorrindo para a câmera com o celular na mão numa avenida ao entardecer"
        className="absolute inset-x-0 top-0 h-[56%] w-full object-cover object-[56%_top] md:inset-0 md:h-full md:object-[30%_center]"
      />
      {/* Scrim: de baixo pra cima no mobile, da esquerda pra direita no desktop */}
      <div
        aria-hidden
        className="absolute inset-0 md:hidden"
        style={{ background: 'linear-gradient(180deg, rgba(7,11,20,0.3), rgba(7,11,20,0) 22%, rgba(7,11,20,0.75) 46%, #070B14 56%)' }}
      />
      <div
        aria-hidden
        className="absolute inset-0 hidden md:block"
        style={{ background: 'linear-gradient(90deg, rgba(7,11,20,0.92) 0%, rgba(7,11,20,0.65) 32%, rgba(7,11,20,0) 55%)' }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-end gap-5 px-4 pb-8 pt-20 md:mx-0 md:max-w-none md:justify-center md:px-[clamp(32px,6vw,96px)] md:py-12">
        <div className="flex w-full flex-col gap-5 md:max-w-[420px] md:gap-7">
          <PixifyLogo size="md" className="[&_span:last-child]:text-white" />
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

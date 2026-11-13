import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FotoBannerProps {
  foto: string;
  /** Posição da foto (classe object-position do Tailwind), p.ex. "object-[center_30%]". */
  fotoPos?: string;
  eyebrow?: ReactNode;
  titulo: ReactNode;
  texto?: ReactNode;
  className?: string;
}

/**
 * Faixa com um personagem das campanhas à direita e o texto no navy da esquerda
 * (mesmo desenho do "Resumo do mês" do início).
 */
export function FotoBanner({ foto, fotoPos = 'object-center', eyebrow, titulo, texto, className }: FotoBannerProps) {
  return (
    <div
      className={cn('relative isolate h-36 w-full max-w-[640px] overflow-hidden rounded-[20px] md:h-40 md:rounded-3xl', className)}
      style={{ background: 'hsl(var(--navy-card))' }}
    >
      <img src={foto} alt="" className={cn('absolute inset-y-0 right-0 h-full w-[68%] object-cover', fotoPos)} />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, hsl(var(--navy-card)) 34%, hsl(var(--navy-card) / 0.6) 52%, hsl(var(--navy-card) / 0) 74%)' }}
      />
      <div className="relative z-10 flex h-full max-w-[62%] flex-col justify-center px-5 md:px-7">
        {eyebrow && <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">{eyebrow}</span>}
        <span className="mt-1 text-[17px] font-semibold leading-snug text-white md:text-[20px]">{titulo}</span>
        {texto && <span className="mt-1.5 text-[12.5px] leading-snug text-white/75 md:text-[13.5px]">{texto}</span>}
      </div>
    </div>
  );
}

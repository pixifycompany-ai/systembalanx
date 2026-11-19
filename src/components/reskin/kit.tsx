// Kit visual do reskin (o mesmo usado nos previews aprovados).
// Peças pequenas e sem estado de negócio: cada tela monta o seu conteúdo com elas.
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HexWatermark } from '@/components/shared/NavySurface';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW } from '@/components/shared/navyTokens';

/** Cabeçalho de página: eyebrow pequeno + título leve grande + ações à direita. */
export function PageHeader({ eyebrow, title, children, className }: { eyebrow?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-[13px] text-foreground-muted">{eyebrow}</p>}
        <h1 className="font-heading text-[38px] font-light leading-none tracking-[-0.04em] text-foreground md:text-[46px]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Pílulas segmentadas (selecionado = escuro). */
export function Segmented<T extends string>({ value, onChange, opts, className, size = 'md' }: { value: T; onChange: (v: T) => void; opts: [T, React.ReactNode][]; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('flex gap-1 rounded-full border border-border bg-surface p-1', className)}>
      {opts.map(([v, r]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          className={cn('flex-1 whitespace-nowrap rounded-full px-3 transition-colors', size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-[13px]',
            value === v ? 'bg-foreground font-medium text-background' : 'text-foreground-muted hover:text-foreground')}>{r}</button>
      ))}
    </div>
  );
}

/** Cartão de conteúdo padrão. */
export function Card({ title, sub, action, children, className, id }: { title?: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-20 rounded-[24px] border border-border bg-surface p-4 md:p-5', className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">{title && <p className="text-[15px] font-semibold text-foreground">{title}</p>}{sub && <p className="text-[12.5px] text-foreground-muted">{sub}</p>}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Bloco navy com a marca d'água do isotipo (o "pattern" da logo). */
export function NavyCard({ children, className, watermarkClassName }: { children: React.ReactNode; className?: string; watermarkClassName?: string }) {
  return (
    <div className={cn('relative isolate overflow-hidden rounded-[24px] p-5 text-white', className)} style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}>
      <HexWatermark className={cn('-right-10 -top-8 bottom-auto h-48', watermarkClassName)} />
      {children}
    </div>
  );
}

/** Seção numerada de formulário (modais de criar/editar). */
export function Secao({ n, title, children, extra }: { n: number; title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-border bg-surface p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground-muted">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-foreground text-[10.5px] text-background">{n}</span>{title}
        </p>
        {extra}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Rótulo + campo. */
export function Campo({ label, children, hint, className }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-[12.5px] text-foreground-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-foreground-subtle">{hint}</span>}
    </label>
  );
}

/** Bloco com título em caixa-alta (usado nos modais de detalhe). */
export function Bloco({ title, children, className, extra }: { title: string; children: React.ReactNode; className?: string; extra?: React.ReactNode }) {
  return (
    <section className={cn('rounded-[20px] border border-border bg-surface p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2"><p className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">{title}</p>{extra}</div>
      {children}
    </section>
  );
}

/** Linha com ícone redondo, título, subtítulo e ação. */
export function Linha({ icon, title, sub, action }: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground-muted">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] text-foreground">{title}</span>{sub && <span className="block truncate text-[12px] text-foreground-muted">{sub}</span>}</span>
      {action}
    </div>
  );
}

/** Topo de modal (eyebrow + título + fechar). Use dentro de SheetContent com p-0. */
export function ModalHeader({ eyebrow, title, onClose, children }: { eyebrow?: React.ReactNode; title: React.ReactNode; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4 md:px-6">
      <div className="min-w-0">
        {eyebrow && <p className="text-[12px] text-foreground-muted">{eyebrow}</p>}
        <h2 className="truncate font-heading text-[24px] font-light tracking-[-0.03em] text-foreground">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground-muted hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/** Rodapé de modal com ações. */
export function ModalFooter({ left, children }: { left?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3.5 pb-safe md:px-6">
      <span>{left}</span>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

/** Corpo rolável de modal (entre ModalHeader e ModalFooter). */
export function ModalShell({ children }: { children: React.ReactNode }) {
  return <div className="flex max-h-[92dvh] flex-col md:max-h-[88dvh]">{children}</div>;
}

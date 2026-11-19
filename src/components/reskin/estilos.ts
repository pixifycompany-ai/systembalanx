// Classes utilitárias do reskin (separadas do kit por causa do fast refresh).
import { cn } from '@/lib/utils';

/** Classes de botão do reskin. */
export const btn = {
  primary: 'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-foreground px-5 text-[13.5px] font-medium text-background hover:opacity-90 disabled:opacity-40',
  outline: 'inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-4 text-[13.5px] text-foreground hover:bg-surface-2 disabled:opacity-40',
  ghost: 'inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13.5px] text-foreground-muted hover:text-foreground',
  danger: 'inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13.5px] text-danger-fg hover:bg-danger-bg',
  mini: 'h-8 shrink-0 rounded-full border border-border px-3 text-[12.5px] text-foreground hover:bg-surface-2',
  icon: 'grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-foreground-muted hover:text-foreground disabled:opacity-40',
};

/** Classe de campo nativo (input/select) no padrão do reskin. */
export const campoCls = 'h-10 w-full rounded-xl border border-input bg-surface-2 px-3 text-[14px] text-foreground outline-none focus:ring-2 focus:ring-ring';

/** Classes do SheetContent para modais grandes (centralizado no desktop, de baixo no celular). */
export const modalCls = (maxW = 'sm:max-w-[880px]') => cn('max-h-[92dvh] overflow-hidden rounded-t-[26px] bg-background p-0', maxW);


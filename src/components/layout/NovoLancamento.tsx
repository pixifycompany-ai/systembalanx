import { useNavigate } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { NOVO_ACOES } from './navItems';

/** "O que você quer lançar?" — usado pelo "+ Novo" da sidebar e pelo + do celular. */
export function NovoLancamento({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const ir = (to: string) => { onOpenChange(false); navigate(to); };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className="rounded-t-[26px] bg-surface p-0 sm:max-w-[520px]">
        <div className="p-5 pb-safe">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-[12px] text-foreground-muted">Adicionar</p>
              <SheetTitle className="font-heading text-[24px] font-light tracking-[-0.03em] text-foreground">O que você quer lançar?</SheetTitle>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-foreground-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {NOVO_ACOES.filter((a) => a.destaque).map((a) => (
              <button key={a.label} type="button" onClick={() => ir(a.to)} className="flex flex-col items-center gap-2 rounded-[20px] border border-border bg-surface px-2 py-4 hover:bg-surface-2 active:scale-[0.98]">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-2"><a.icon className={`h-5 w-5 ${a.tom}`} /></span>
                <span className="text-[13px] text-foreground">{a.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 divide-y divide-border rounded-[20px] border border-border">
            {NOVO_ACOES.filter((a) => !a.destaque).map((a) => (
              <button key={a.label} type="button" onClick={() => ir(a.to)} className="flex w-full items-center gap-3 px-4 py-3 text-left first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-surface-2/60">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2"><a.icon className={`h-4 w-4 ${a.tom}`} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[14px] text-foreground">{a.label}</span><span className="block text-[12px] text-foreground-muted">{a.desc}</span></span>
                <ChevronRight className="h-4 w-4 text-foreground-subtle" />
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Avisos de contrato duplicado (ao criar) e mesclagem de duplicados, no padrão do reskin.
import { AlertTriangle, Layers, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { InitialsAvatar } from '@/components/cobrancas/formParts';
import { ModalFooter, ModalHeader, ModalShell, Secao } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { DuplicateGroup, DuplicateMatch } from '@/utils/contractDuplicates';

/** "Contrato similar já existe": registrar como aditivo, criar mesmo assim ou cancelar. */
export function ContratoDuplicadoDialog({ match, novoValor, salvando, onAditivo, onCriarMesmoAssim, onCancelar }: {
  match: DuplicateMatch | null;
  novoValor: number | null;
  salvando: boolean;
  onAditivo: () => void;
  onCriarMesmoAssim: () => void;
  onCancelar: () => void;
}) {
  const aberto = !!match && novoValor !== null;
  return (
    <Sheet open={aberto} onOpenChange={(o) => { if (!o) onCancelar(); }}>
      <SheetContent side="bottom" showHandle showClose={false} className="rounded-t-[26px] bg-surface p-0 sm:max-w-[500px]">
        {match && novoValor !== null && (
          <div className="p-5 pb-safe">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-warning-bg text-warning-fg"><AlertTriangle className="h-5 w-5" /></span>
            <SheetTitle className="mt-3 font-heading text-[22px] font-light tracking-[-0.02em] text-foreground">Contrato parecido já existe</SheetTitle>
            <p className="mt-1 text-[13.5px] text-foreground-muted">
              Encontramos um contrato ativo parecido para <b className="font-medium text-foreground">{match.contrato.cliente?.nome}</b>:
            </p>

            <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-border p-3.5">
              <InitialsAvatar nome={match.contrato.cliente?.nome} className="rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-foreground">{match.contrato.descricao}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-foreground-muted">
                  Valor atual <b className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(Number(match.contrato.valor))}</b>
                  {!match.sameValue && <>→ <b className="font-heading font-semibold tabular-nums text-primary">{formatCurrency(novoValor)}</b></>}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[13.5px] text-foreground">
              {match.sameValue
                ? 'O valor é igual ao do contrato que já existe. Tem certeza que quer criar outro?'
                : <>Parece um <b className="font-medium">reajuste de valor</b>. O melhor é registrar como aditivo no contrato que já existe: o histórico fica guardado e o MRR não conta em dobro.</>}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {!match.sameValue && (
                <button type="button" onClick={onAditivo} disabled={salvando} className={cn(btn.primary, 'h-11 w-full')}>
                  {salvando && <Loader2 className="h-4 w-4 animate-spin" />}Registrar como aditivo (recomendado)
                </button>
              )}
              <button type="button" onClick={onCriarMesmoAssim} disabled={salvando} className={cn(match.sameValue ? btn.primary : btn.outline, 'h-11 w-full')}>
                Criar contrato novo mesmo assim
              </button>
              <button type="button" onClick={onCancelar} disabled={salvando} className={cn(btn.ghost, 'h-11 w-full')}>Cancelar</button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Mesclar duplicados: escolhe o contrato que fica; os outros são encerrados. */
export function MesclarContratosDialog({ grupo, manterId, onManter, mesclando, onMesclar, onFechar }: {
  grupo: DuplicateGroup | null;
  manterId: string | null;
  onManter: (id: string) => void;
  mesclando: boolean;
  onMesclar: () => void;
  onFechar: () => void;
}) {
  return (
    <Sheet open={!!grupo} onOpenChange={(o) => { if (!o) onFechar(); }}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[680px]')}>
        <SheetTitle className="sr-only">Mesclar contratos duplicados</SheetTitle>
        {grupo && (
          <ModalShell>
            <ModalHeader eyebrow={grupo.cliente_nome} title="Mesclar contratos duplicados" onClose={onFechar} />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
              <p className="rounded-2xl bg-surface-2/70 p-3.5 text-[13px] text-foreground-muted">
                Escolha qual contrato de <b className="font-medium text-foreground">{grupo.cliente_nome}</b> continua ativo. Os outros são <b className="font-medium text-foreground">encerrados</b> e os lançamentos pendentes futuros deles saem do caixa.
              </p>
              <Secao n={1} title="Contrato que continua">
                <div className="space-y-2">
                  {grupo.contratos.map((c) => {
                    const on = manterId === c.id;
                    return (
                      <label key={c.id} className={cn('flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-colors', on ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-surface-2')}>
                        <input type="radio" name="keepContrato" checked={on} onChange={() => onManter(c.id)} className="sr-only" />
                        <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', on ? 'border-background' : 'border-border-strong')}>
                          {on && <span className="h-2 w-2 rounded-full bg-background" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{c.descricao}</span>
                          <span className={cn('block text-[12px]', on ? 'text-background/70' : 'text-foreground-muted')}>Início {formatDate(c.data_inicio)}</span>
                        </span>
                        <span className="shrink-0 font-heading text-[15px] font-semibold tabular-nums">{formatCurrency(Number(c.valor))}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="flex items-start gap-2 text-[12px] text-foreground-muted">
                  <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Dica: mantenha o contrato com o valor mais atual. Se um reajuste do encerrado fizer sentido como histórico, ele é anotado como aditivo.
                </p>
              </Secao>
            </div>
            <ModalFooter>
              <button type="button" onClick={onFechar} disabled={mesclando} className={btn.outline}>Cancelar</button>
              <button type="button" onClick={onMesclar} disabled={mesclando || !manterId} className={btn.primary}>
                {mesclando && <Loader2 className="h-4 w-4 animate-spin" />}{mesclando ? 'Mesclando…' : 'Mesclar contratos'}
              </button>
            </ModalFooter>
          </ModalShell>
        )}
      </SheetContent>
    </Sheet>
  );
}

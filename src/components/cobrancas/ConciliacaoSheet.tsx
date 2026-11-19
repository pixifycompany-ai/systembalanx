import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Loader2, Link2, Plus, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { ItemConciliacao } from '@/hooks/useCobrancas';
import { InitialsAvatar, SECTION_LABEL_CLS } from './formParts';
import { ModalFooter, ModalHeader, ModalShell } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';

// Escolha por cobrança: id da receita existente, 'criar' ou 'depois'.
type Escolha = string;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listar: () => Promise<ItemConciliacao[]>;
  aplicar: (itens: { cobranca_id: string; receita_id?: string; criar?: boolean }[]) => Promise<boolean>;
  nomeCliente: (clienteId: string | null) => string;
}

function escolhaInicial(it: ItemConciliacao): Escolha {
  const conf = it.candidatas.filter((c) => c.confiavel);
  if (conf.length === 1) return conf[0].id;
  if (!it.candidatas.some((c) => c.plausivel)) return 'criar';
  return 'depois';
}

export function ConciliacaoSheet({ open, onOpenChange, listar, aplicar, nomeCliente }: Props) {
  const [itens, setItens] = useState<ItemConciliacao[] | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItens(null);
    listar().then((lista) => {
      // Sugestão inicial sem repetir a mesma receita em duas cobranças.
      const usadas = new Set<string>();
      const ini: Record<string, Escolha> = {};
      for (const it of lista) {
        let e = escolhaInicial(it);
        if (e !== 'criar' && e !== 'depois') {
          if (usadas.has(e)) e = 'depois';
          else usadas.add(e);
        }
        ini[it.cobranca.id] = e;
      }
      setEscolhas(ini);
      setItens(lista);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Receitas já escolhidas em outra cobrança (não pode vincular a mesma duas vezes)
  const escolhidaPor = useMemo(() => {
    const m = new Map<string, string>();
    for (const [cobId, e] of Object.entries(escolhas)) if (e !== 'criar' && e !== 'depois') m.set(e, cobId);
    return m;
  }, [escolhas]);

  const handleAplicar = async () => {
    const payload = Object.entries(escolhas)
      .filter(([, e]) => e !== 'depois')
      .map(([cobranca_id, e]) => (e === 'criar' ? { cobranca_id, criar: true } : { cobranca_id, receita_id: e }));
    if (!payload.length) { onOpenChange(false); return; }
    setSalvando(true);
    const ok = await aplicar(payload);
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  const qtdAplicar = Object.values(escolhas).filter((e) => e !== 'depois').length;

  const Opcao = ({ ativo, disabled, onClick, children }: { ativo: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group/op flex w-full items-start gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-colors',
        ativo ? 'is-ativo border-foreground bg-foreground text-background' : 'border-border bg-surface hover:bg-surface-2',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-surface',
      )}
    >
      <span className={cn('mt-0.5 h-4 w-4 shrink-0 rounded-full border', ativo ? 'border-background bg-background shadow-[inset_0_0_0_3px_hsl(var(--foreground))]' : 'border-border-strong')} />
      <span className="min-w-0 flex-1 group-[.is-ativo]/op:[&_*]:!text-background">{children}</span>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !salvando && onOpenChange(o)}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[680px]')}>
        <SheetTitle className="sr-only">Conciliar com o financeiro</SheetTitle>
        <ModalShell>
          <ModalHeader eyebrow="Cobranças" title="Conciliar com o financeiro" onClose={() => !salvando && onOpenChange(false)} />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
            <p className="rounded-2xl bg-surface-2/70 px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground-muted">
              Estas cobranças ainda não estão ligadas a uma receita a receber. Escolha a receita que você já lançou (evita duplicar) ou crie uma nova.
              A receita vinculada passa a usar o <b className="font-medium text-foreground">valor e o vencimento da cobrança do Asaas</b>; descrição e categoria continuam as suas.
            </p>

            {itens === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Buscando receitas correspondentes…</div>
            ) : itens.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle2 className="h-6 w-6 text-success-fg" />
                <p className="text-[14px] text-foreground">Tudo conciliado.</p>
                <p className="text-[12.5px] text-foreground-muted">Nenhuma cobrança sem receita.</p>
              </div>
            ) : (
              <>
                <p className={SECTION_LABEL_CLS}>{itens.length} {itens.length === 1 ? 'cobrança sem receita' : 'cobranças sem receita'}</p>
                {itens.map((it) => {
                  const cob = it.cobranca;
                  const esc = escolhas[cob.id] ?? 'depois';
                  const set = (e: Escolha) => setEscolhas((p) => ({ ...p, [cob.id]: e }));
                  return (
                    <section key={cob.id} className="rounded-[20px] border border-border bg-surface p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <InitialsAvatar nome={nomeCliente(cob.cliente_id)} className="rounded-full" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium text-foreground">{nomeCliente(cob.cliente_id)}</div>
                          <div className="truncate text-[12px] text-foreground-muted">{cob.descricao || 'Cobrança'} · vence {formatDate(cob.vencimento)}</div>
                        </div>
                        <div className="shrink-0 font-heading text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">{formatCurrency(Number(cob.valor))}</div>
                      </div>

                      <div className="space-y-1.5">
                        {it.candidatas.map((c) => {
                          const outra = escolhidaPor.get(c.id);
                          const ocupada = !!outra && outra !== cob.id;
                          return (
                            <Opcao key={c.id} ativo={esc === c.id} disabled={ocupada} onClick={() => set(c.id)}>
                              <span className="flex items-center gap-1.5">
                                <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="truncate text-[13px] font-medium text-foreground">{c.descricao}</span>
                                {c.confiavel && <span className="shrink-0 rounded-full bg-success-bg px-2 py-px text-[10.5px] font-semibold text-success-fg">sugerida</span>}
                              </span>
                              <span className="mt-0.5 block text-[11.5px] text-foreground-muted">
                                {formatCurrency(c.valor)} · vence {formatDate(c.data_vencimento)}{c.status === 'atrasado' ? ' · atrasada' : ''}
                                {!c.mesmoValor && <span className="text-[hsl(var(--warning-fg))]"> · valor diferente (vai para {formatCurrency(Number(cob.valor))})</span>}
                                {ocupada && ' · já escolhida em outra cobrança'}
                              </span>
                            </Opcao>
                          );
                        })}
                        <Opcao ativo={esc === 'criar'} onClick={() => set('criar')}>
                          <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"><Plus className="h-3.5 w-3.5 text-foreground-muted" /> Criar receita nova</span>
                          <span className="mt-0.5 block text-[11.5px] text-foreground-muted">Use quando não existe lançamento para esta cobrança.</span>
                        </Opcao>
                        <Opcao ativo={esc === 'depois'} onClick={() => set('depois')}>
                          <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"><Clock className="h-3.5 w-3.5 text-foreground-muted" /> Decidir depois</span>
                        </Opcao>
                      </div>
                    </section>
                  );
                })}
              </>
            )}
          </div>
          {itens && itens.length > 0 && (
            <ModalFooter left={<span className="text-[12.5px] text-foreground-muted">{qtdAplicar} de {itens.length} com escolha</span>}>
              <button type="button" className={btn.outline} onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</button>
              <button type="button" className={btn.primary} onClick={handleAplicar} disabled={salvando || qtdAplicar === 0}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Aplicar ({qtdAplicar})
              </button>
            </ModalFooter>
          )}
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}

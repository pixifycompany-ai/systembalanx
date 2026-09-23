import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, Link2, Plus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { ItemConciliacao } from '@/hooks/useCobrancas';

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
        'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
        ativo ? 'border-primary bg-primary/10' : 'border-border/60 bg-surface/50 hover:bg-surface-2',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-surface/50',
      )}
    >
      <span className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border', ativo ? 'border-primary bg-primary shadow-[inset_0_0_0_2px_hsl(var(--surface))]' : 'border-border-strong')} />
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.95] backdrop-blur-2xl sm:max-w-[640px] sm:mx-auto">
        <div className="mx-auto w-full max-w-[600px] pb-6 pt-1">
          <p className="text-xs font-medium text-foreground-muted">Cobranças</p>
          <h2 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-foreground">Conciliar com o financeiro</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground-muted">
            Estas cobranças ainda não estão ligadas a uma receita a receber. Escolha a receita que você já lançou (evita duplicar) ou crie uma nova.
            A receita vinculada passa a usar o <b>valor e o vencimento da cobrança do Asaas</b>; descrição e categoria continuam as suas.
          </p>

          {itens === null ? (
            <div className="flex items-center gap-2 py-10 text-sm text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Buscando receitas correspondentes…</div>
          ) : itens.length === 0 ? (
            <p className="py-10 text-center text-sm text-foreground-muted">Tudo conciliado. Nenhuma cobrança sem receita.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {itens.map((it) => {
                const cob = it.cobranca;
                const esc = escolhas[cob.id] ?? 'depois';
                const set = (e: Escolha) => setEscolhas((p) => ({ ...p, [cob.id]: e }));
                return (
                  <div key={cob.id} className="rounded-xl border border-border/60 bg-surface/40 p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{nomeCliente(cob.cliente_id)}</div>
                        <div className="truncate text-[11px] text-foreground-muted">{cob.descricao || 'Cobrança'} · vence {formatDate(cob.vencimento)}</div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatCurrency(Number(cob.valor))}</div>
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
                              {c.confiavel && <span className="shrink-0 rounded-full bg-[hsl(var(--success))]/15 px-1.5 py-px text-[9.5px] font-semibold text-[hsl(var(--success))]">sugerida</span>}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-foreground-muted">
                              {formatCurrency(c.valor)} · vence {formatDate(c.data_vencimento)}{c.status === 'atrasado' ? ' · atrasada' : ''}
                              {!c.mesmoValor && <span className="text-[hsl(var(--warning))]"> · valor diferente (vai para {formatCurrency(Number(cob.valor))})</span>}
                              {ocupada && ' · já escolhida em outra cobrança'}
                            </span>
                          </Opcao>
                        );
                      })}
                      <Opcao ativo={esc === 'criar'} onClick={() => set('criar')}>
                        <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"><Plus className="h-3.5 w-3.5 text-foreground-muted" /> Criar receita nova</span>
                        <span className="mt-0.5 block text-[11px] text-foreground-muted">Use quando não existe lançamento para esta cobrança.</span>
                      </Opcao>
                      <Opcao ativo={esc === 'depois'} onClick={() => set('depois')}>
                        <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"><Clock className="h-3.5 w-3.5 text-foreground-muted" /> Decidir depois</span>
                      </Opcao>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {itens && itens.length > 0 && (
            <div className="sticky bottom-0 mt-4 flex gap-2 bg-surface/[0.95] pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleAplicar} disabled={salvando || qtdAplicar === 0}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aplicar ({qtdAplicar})
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

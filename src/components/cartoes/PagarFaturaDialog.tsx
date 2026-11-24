import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, Landmark, Plus, Trash2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ModalHeader, ModalFooter, ModalShell, Segmented, Campo } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { ContaDB } from '@/hooks/useContas';
import type { FaturaDB } from '@/hooks/useFaturas';
import { useFaturas } from '@/hooks/useFaturas';
import { digitarMoeda, mostrarMoeda } from '@/lib/moeda';

interface PagarFaturaDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cartao: ContaDB;
  fatura: FaturaDB;
  contasBancarias: ContaDB[];
}

interface Linha {
  conta_id: string;
  valor: number;
  data_pagamento: string;
}

export function PagarFaturaDialog({ open, onOpenChange, cartao, fatura, contasBancarias }: PagarFaturaDialogProps) {
  const { pagarFatura } = useFaturas(cartao.id);
  const restante = Math.round((Number(fatura.valor_total) - Number(fatura.valor_pago)) * 100) / 100;
  const today = format(new Date(), 'yyyy-MM-dd');

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [modo, setModo] = useState<'total' | 'outro'>('total');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setModo('total');
      setLinhas([
        { conta_id: cartao.conta_pagamento_padrao_id || contasBancarias[0]?.id || '', valor: restante, data_pagamento: today },
      ]);
    }
  }, [open, cartao.conta_pagamento_padrao_id, restante, contasBancarias, today]);

  const total = useMemo(() => linhas.reduce((s, l) => s + Number(l.valor || 0), 0), [linhas]);
  const podeConfirmar = total > 0 && total <= restante + 0.001 && linhas.every(l => l.conta_id);
  const dividido = linhas.length > 1;

  const addLinha = () => {
    const restanteAposLinhas = Math.max(restante - total, 0);
    setModo('outro');
    setLinhas(prev => [...prev, { conta_id: contasBancarias.find((c) => !prev.some((l) => l.conta_id === c.id))?.id || contasBancarias[0]?.id || '', valor: restanteAposLinhas, data_pagamento: prev[0]?.data_pagamento || today }]);
  };
  const removeLinha = (i: number) => setLinhas(prev => prev.filter((_, idx) => idx !== i));
  const updateLinha = (i: number, patch: Partial<Linha>) =>
    setLinhas(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const trocarModo = (m: 'total' | 'outro') => {
    setModo(m);
    if (m === 'total') setLinhas((prev) => [{ ...(prev[0] || { conta_id: contasBancarias[0]?.id || '', data_pagamento: today }), valor: restante }]);
  };

  const handleConfirm = async () => {
    setLoading(true);
    const ok = await pagarFatura(fatura, cartao, linhas);
    setLoading(false);
    if (ok) onOpenChange(false);
  };

  const principal = linhas[0];
  const contaPrincipal = contasBancarias.find((c) => c.id === principal?.conta_id);
  const saldoDepois = contaPrincipal ? Number(contaPrincipal.saldo_atual || 0) - Number(principal?.valor || 0) : null;
  const competencia = format(parseISO(fatura.competencia), 'MMMM/yyyy', { locale: ptBR });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
        <ModalShell>
          <ModalHeader eyebrow={<>{cartao.nome} · <span className="capitalize">{competencia}</span></>} title="Pagar fatura" onClose={() => onOpenChange(false)} />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Total da fatura', formatCurrency(Number(fatura.valor_total)), 'text-foreground'],
                ['Já pago', formatCurrency(Number(fatura.valor_pago)), 'text-success-fg'],
                ['Vence', format(parseISO(fatura.data_vencimento), 'dd/MM/yyyy'), 'text-foreground'],
              ].map(([r, v, c]) => (
                <div key={r} className="rounded-2xl bg-surface-2/70 p-3"><p className="text-[11.5px] text-foreground-muted">{r}</p><p className={cn('truncate text-[14px] font-semibold tabular-nums', c)}>{v}</p></div>
              ))}
            </div>

            {!dividido && (
              <>
                <Segmented<'total' | 'outro'> value={modo} onChange={trocarModo} opts={[['total', 'Valor em aberto'], ['outro', 'Outro valor']]} />
                {modo === 'outro' ? (
                  <div className="flex h-14 items-center rounded-2xl border border-input bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-ring">
                    <span className="mr-1.5 text-[18px] text-foreground-muted">R$</span>
                    <input type="text" inputMode="numeric" value={mostrarMoeda(principal?.valor)} onChange={(e) => updateLinha(0, { valor: digitarMoeda(e.target.value) })}
                      className="min-w-0 flex-1 bg-transparent font-heading text-[24px] font-semibold tabular-nums text-foreground outline-none" />
                  </div>
                ) : (
                  <p className="font-heading text-[32px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{formatCurrency(restante)}</p>
                )}

                <div>
                  <p className="mb-2 text-[12.5px] text-foreground-muted">Pagar com</p>
                  <div className="space-y-2">
                    {contasBancarias.map((x) => {
                      const on = principal?.conta_id === x.id;
                      return (
                        <button key={x.id} type="button" onClick={() => updateLinha(0, { conta_id: x.id })} className={cn('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors', on ? 'border-foreground bg-surface' : 'border-border hover:bg-surface-2/50')}>
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: x.cor }}><Landmark className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-[14px] text-foreground">{x.nome}</span><span className="block truncate text-[12px] text-foreground-muted">{[x.banco, `saldo ${formatCurrency(Number(x.saldo_atual || 0))}`].filter(Boolean).join(' · ')}</span></span>
                          {cartao.conta_pagamento_padrao_id === x.id && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-foreground-muted">padrão</span>}
                          <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border', on ? 'border-foreground bg-foreground text-background' : 'border-border-strong')}>{on && <Check className="h-3 w-3" />}</span>
                        </button>
                      );
                    })}
                    {contasBancarias.length === 0 && <p className="rounded-2xl bg-warning-bg px-3 py-2.5 text-[12.5px] text-warning-fg">Cadastre uma conta bancária para registrar o pagamento.</p>}
                  </div>
                </div>

                <Campo label="Data do pagamento">
                  <input type="date" value={principal?.data_pagamento || today} onChange={(e) => updateLinha(0, { data_pagamento: e.target.value })} className={campoCls} />
                </Campo>

                {saldoDepois !== null && contaPrincipal && (
                  <div className={cn('rounded-2xl p-3 text-[13px]', saldoDepois < 0 ? 'bg-danger-bg text-danger-fg' : 'bg-surface-2/70 text-foreground-muted')}>
                    Saldo da {contaPrincipal.nome} depois: <b className="font-semibold">{formatCurrency(saldoDepois)}</b>{saldoDepois < 0 && ' — não cobre o pagamento'}
                  </div>
                )}
              </>
            )}

            {dividido && (
              <div className="space-y-2">
                <p className="text-[12.5px] text-foreground-muted">Pagamento dividido entre contas</p>
                {linhas.map((linha, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2 rounded-2xl border border-border p-2.5">
                    <select value={linha.conta_id} onChange={(e) => updateLinha(i, { conta_id: e.target.value })} className={campoCls} aria-label="Conta">
                      {contasBancarias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    <Input type="number" step="0.01" value={linha.valor} onChange={(e) => updateLinha(i, { valor: parseFloat(e.target.value) || 0 })} className="h-10 text-right font-semibold tabular-nums" aria-label="Valor" />
                    <button type="button" onClick={() => removeLinha(i)} aria-label="Remover conta" className="grid h-9 w-9 place-items-center rounded-full text-foreground-muted hover:bg-danger-bg hover:text-danger-fg"><Trash2 className="h-4 w-4" /></button>
                    <input type="date" value={linha.data_pagamento} onChange={(e) => updateLinha(i, { data_pagamento: e.target.value })} className={cn(campoCls, 'col-span-3')} aria-label="Data do pagamento" />
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={addLinha} className="flex items-center gap-1.5 text-[13px] font-medium text-primary"><Plus className="h-4 w-4" />{dividido ? 'Adicionar outra conta' : 'Dividir entre contas'}</button>

            <div className="space-y-1.5 rounded-2xl border border-border px-4 py-3 text-[13px]">
              <div className="flex justify-between"><span className="text-foreground-muted">Vai pagar</span><span className={cn('font-semibold tabular-nums', total > restante + 0.001 ? 'text-danger-fg' : 'text-foreground')}>{formatCurrency(total)}</span></div>
              <div className="flex justify-between border-t border-border pt-1.5"><span className="text-foreground-muted">Fica em aberto na fatura</span><span className="font-semibold tabular-nums text-foreground">{formatCurrency(Math.max(restante - total, 0))}</span></div>
              {total > restante + 0.001 && <p className="text-[12px] text-danger-fg">O valor passa do que está em aberto.</p>}
            </div>
          </div>
          <ModalFooter>
            <button type="button" className={btn.outline} onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="button" className={btn.primary} onClick={handleConfirm} disabled={!podeConfirmar || loading}>{loading ? 'Processando…' : `Pagar ${formatCurrency(total)}`}</button>
          </ModalFooter>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/utils/formatters';
import type { ContaDB } from '@/hooks/useContas';
import type { FaturaDB } from '@/hooks/useFaturas';
import { useFaturas } from '@/hooks/useFaturas';

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLinhas([
        { conta_id: cartao.conta_pagamento_padrao_id || contasBancarias[0]?.id || '', valor: restante, data_pagamento: today },
      ]);
    }
  }, [open, cartao.conta_pagamento_padrao_id, restante, contasBancarias, today]);

  const total = useMemo(() => linhas.reduce((s, l) => s + Number(l.valor || 0), 0), [linhas]);
  const podeConfirmar = total > 0 && total <= restante + 0.001 && linhas.every(l => l.conta_id);

  const addLinha = () => {
    const restanteAposLinhas = Math.max(restante - total, 0);
    setLinhas(prev => [...prev, { conta_id: contasBancarias[0]?.id || '', valor: restanteAposLinhas, data_pagamento: today }]);
  };
  const removeLinha = (i: number) => setLinhas(prev => prev.filter((_, idx) => idx !== i));
  const updateLinha = (i: number, patch: Partial<Linha>) =>
    setLinhas(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const handleConfirm = async () => {
    setLoading(true);
    const ok = await pagarFatura(fatura, cartao, linhas);
    setLoading(false);
    if (ok) onOpenChange(false);
  };

  const mini = [
    { lab: 'Compet.', val: format(parseISO(fatura.competencia), 'MMM', { locale: ptBR }), accent: 'hsl(var(--primary))' },
    { lab: 'Vencim.', val: format(parseISO(fatura.data_vencimento), 'dd/MM'), accent: 'hsl(38 82% 55%)' },
    { lab: 'Em aberto', val: formatCurrency(restante), accent: 'hsl(var(--danger))', danger: true },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle className="p-0 max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.55] backdrop-blur-2xl backdrop-saturate-[1.8] sm:max-w-[560px] sm:mx-auto">
        {/* Header */}
        <div className="px-5 pt-1 pb-3">
          <div className="text-[11.5px] font-medium text-foreground-muted">
            {cartao.nome} · {format(parseISO(fatura.competencia), "MMMM", { locale: ptBR })}
          </div>
          <h2 className="mt-0.5 text-[22px] font-[670] tracking-[-0.02em] text-foreground">Pagar fatura</h2>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Mini-cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {mini.map((m) => (
              <div key={m.lab} className="auro-card relative overflow-hidden rounded-2xl border border-border/60 bg-surface/55 px-3 py-2.5">
                <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: m.accent }} />
                <div className="text-[9.5px] font-semibold uppercase tracking-wide text-foreground-muted">{m.lab}</div>
                <div className={`mt-1 text-[14px] font-bold tabular-nums ${m.danger ? 'text-[hsl(var(--danger))]' : 'text-foreground'}`}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* Pagar com */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-foreground-muted">Pagar com</div>
            {linhas.map((linha, i) => {
              const conta = contasBancarias.find(c => c.id === linha.conta_id);
              return (
                <div key={i} className="auro-card flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/55 px-3 py-2.5">
                  <Select value={linha.conta_id} onValueChange={(v) => updateLinha(i, { conta_id: v })}>
                    <SelectTrigger className="h-8 flex-1 border-0 bg-transparent px-0 focus:ring-0">
                      {conta
                        ? <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: conta.cor }} />{conta.nome}</span>
                        : <SelectValue placeholder="Conta" />}
                    </SelectTrigger>
                    <SelectContent>
                      {contasBancarias.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.cor }} />{c.nome}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    value={linha.valor}
                    onChange={(e) => updateLinha(i, { valor: parseFloat(e.target.value) || 0 })}
                    className="h-8 w-28 border-0 bg-transparent px-0 text-right text-sm font-semibold tabular-nums focus-visible:ring-0"
                  />
                  {linhas.length > 1 && (
                    <button onClick={() => removeLinha(i)} className="shrink-0 text-foreground-muted hover:text-[hsl(var(--danger))]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
            <button onClick={addLinha} className="flex items-center gap-2 px-1 py-1.5 text-[13px] font-semibold text-[hsl(38_82%_55%)]">
              <PlusIcon className="h-4 w-4" strokeWidth={2.2} /> Adicionar outra conta
            </button>
          </div>

          {/* Totais */}
          <div className="auro-card rounded-2xl border border-border/60 bg-surface/55 px-4 py-3.5 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">Total selecionado</span>
              <span className={`font-bold tabular-nums ${total > restante + 0.001 ? 'text-[hsl(var(--danger))]' : 'text-foreground'}`}>{formatCurrency(total)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">Saldo após pagamento</span>
              <span className="font-semibold tabular-nums text-foreground">{formatCurrency(Math.max(restante - total, 0))}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 pt-1">
            <button onClick={() => onOpenChange(false)} className="flex-[0_0_34%] rounded-[14px] bg-surface-2 py-3 text-[13px] font-semibold text-foreground">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!podeConfirmar || loading}
              className="flex-1 rounded-[14px] bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] py-3 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Processando…' : 'Confirmar pagamento'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

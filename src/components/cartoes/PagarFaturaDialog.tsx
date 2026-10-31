import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
    { lab: 'Competência', val: format(parseISO(fatura.competencia), 'MMM', { locale: ptBR }) },
    { lab: 'Vencimento', val: format(parseISO(fatura.data_vencimento), 'dd/MM') },
    { lab: 'Em aberto', val: formatCurrency(restante), danger: true },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle className="p-0 max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[560px] sm:mx-auto">
        {/* Header */}
        <div className="px-5 pt-1 pb-3">
          <div className="text-[13px] text-foreground-muted">
            {cartao.nome} · <span className="capitalize">{format(parseISO(fatura.competencia), "MMMM", { locale: ptBR })}</span>
          </div>
          <h2 className="mt-0.5 text-[24px] font-semibold tracking-[-0.03em] text-foreground">Pagar fatura</h2>
        </div>

        <div className="px-5 pb-5 space-y-5">
          {/* Resumo: faixa de 3 KPIs colados */}
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[20px] border border-border bg-border">
            {mini.map((m) => (
              <div key={m.lab} className="flex min-w-0 flex-col gap-1 bg-surface px-3 py-3">
                <span className="truncate text-[11px] text-foreground-muted">{m.lab}</span>
                <span className={`truncate font-heading text-[15px] font-semibold capitalize tabular-nums tracking-[-0.02em] ${m.danger ? 'text-[hsl(var(--danger-fg))]' : 'text-foreground'}`}>{m.val}</span>
              </div>
            ))}
          </div>

          {/* Pagar com */}
          <section className="space-y-2">
            <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Pagar com</h3>
            <div className="rounded-[20px] border border-border bg-surface px-3.5">
              {linhas.map((linha, i) => {
                const conta = contasBancarias.find(c => c.id === linha.conta_id);
                return (
                  <div key={i} className="flex items-center gap-2 border-b border-border py-2.5 last:border-b-0">
                    <Select value={linha.conta_id} onValueChange={(v) => updateLinha(i, { conta_id: v })}>
                      <SelectTrigger className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 focus:ring-0">
                        {conta
                          ? <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: conta.cor }} /><span className="truncate">{conta.nome}</span></span>
                          : <SelectValue placeholder="Conta" />}
                      </SelectTrigger>
                      <SelectContent>
                        {contasBancarias.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} />{c.nome}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      value={linha.valor}
                      onChange={(e) => updateLinha(i, { valor: parseFloat(e.target.value) || 0 })}
                      className="h-9 w-28 rounded-full px-3 text-right font-heading text-sm font-semibold tabular-nums"
                    />
                    {linhas.length > 1 && (
                      <button onClick={() => removeLinha(i)} aria-label="Remover conta" className="no-touch-min grid h-8 w-8 shrink-0 place-items-center rounded-full text-foreground-muted hover:bg-danger-bg hover:text-[hsl(var(--danger-fg))]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={addLinha} className="no-touch-min flex items-center gap-1.5 px-1 py-1 text-[13px] font-semibold text-primary">
              <PlusIcon className="h-4 w-4" strokeWidth={2.2} /> Adicionar outra conta
            </button>
          </section>

          {/* Totais */}
          <div className="space-y-2 rounded-[20px] border border-border px-4 py-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">Total selecionado</span>
              <span className={`font-heading font-semibold tabular-nums ${total > restante + 0.001 ? 'text-[hsl(var(--danger-fg))]' : 'text-foreground'}`}>{formatCurrency(total)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
              <span className="text-foreground-muted">Saldo após pagamento</span>
              <span className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(Math.max(restante - total, 0))}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 pt-1">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-[2]"
              onClick={handleConfirm}
              disabled={!podeConfirmar || loading}
            >
              {loading ? 'Processando…' : 'Confirmar pagamento'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

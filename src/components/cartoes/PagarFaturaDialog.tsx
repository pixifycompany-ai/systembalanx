import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const restante = Number(fatura.valor_total) - Number(fatura.valor_pago);
  const today = format(new Date(), 'yyyy-MM-dd');

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLinhas([
        {
          conta_id: cartao.conta_pagamento_padrao_id || contasBancarias[0]?.id || '',
          valor: restante,
          data_pagamento: today,
        },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Pagar Fatura — {cartao.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted p-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Competência</p>
              <p className="font-medium">{format(parseISO(fatura.competencia), 'MMM/yyyy', { locale: ptBR })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="font-medium">{format(parseISO(fatura.data_vencimento), 'dd/MM/yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em aberto</p>
              <p className="font-bold">{formatCurrency(restante)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pagar com</Label>
            {linhas.map((linha, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Select value={linha.conta_id} onValueChange={(v) => updateLinha(i, { conta_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
                    <SelectContent>
                      {contasBancarias.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="0.01"
                    value={linha.valor}
                    onChange={(e) => updateLinha(i, { valor: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="date"
                    value={linha.data_pagamento}
                    onChange={(e) => updateLinha(i, { data_pagamento: e.target.value })}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  {linhas.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeLinha(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLinha} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar conta
            </Button>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm">
              <p className="text-muted-foreground">Total selecionado</p>
              <p className={`font-bold text-lg tabular-nums ${total > restante + 0.001 ? 'text-destructive' : ''}`}>
                {formatCurrency(total)}
              </p>
            </div>
            <div className="text-sm text-right">
              <p className="text-muted-foreground">Saldo após pagamento</p>
              <p className="font-medium tabular-nums">{formatCurrency(Math.max(restante - total, 0))}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!podeConfirmar || loading}>
            {loading ? 'Processando...' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

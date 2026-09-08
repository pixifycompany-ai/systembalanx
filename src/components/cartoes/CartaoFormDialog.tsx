import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { parseISO } from 'date-fns';
import type { ContaDB, ContaFormData } from '@/hooks/useContas';

const CORES = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Diners'];

interface CartaoFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cartao?: ContaDB | null;
  contasBancarias: ContaDB[];
  onSubmit: (data: ContaFormData) => Promise<void>;
}

const empty = (): ContaFormData => ({
  nome: '',
  banco: '',
  tipo: 'cartao_credito',
  saldo_inicial: 0,
  cor: '#8B5CF6',
  ativa: true,
  bandeira: '',
  limite: null,
  dia_fechamento: null,
  dia_vencimento: null,
  vencimento_anchor: null,
  conta_pagamento_padrao_id: null,
});

export function CartaoFormDialog({ open, onOpenChange, cartao, contasBancarias, onSubmit }: CartaoFormDialogProps) {
  const [form, setForm] = useState<ContaFormData>(empty());
  const [proximoVencimento, setProximoVencimento] = useState<string>('');

  useEffect(() => {
    if (cartao) {
      setForm({
        nome: cartao.nome,
        banco: cartao.banco || '',
        tipo: 'cartao_credito',
        saldo_inicial: 0,
        cor: cartao.cor,
        ativa: cartao.ativa,
        bandeira: cartao.bandeira || '',
        limite: cartao.limite ?? null,
        dia_fechamento: cartao.dia_fechamento ?? null,
        dia_vencimento: cartao.dia_vencimento ?? null,
        vencimento_anchor: cartao.vencimento_anchor ?? null,
        conta_pagamento_padrao_id: cartao.conta_pagamento_padrao_id ?? null,
      });
      setProximoVencimento(cartao.vencimento_anchor ?? '');
    } else {
      setForm(empty());
      setProximoVencimento('');
    }
  }, [cartao, open]);

  const isNew = !cartao;
  const valid = isNew
    ? form.nome.trim().length > 0 &&
      !!form.dia_fechamento && form.dia_fechamento >= 1 && form.dia_fechamento <= 31 &&
      !!proximoVencimento
    : form.nome.trim().length > 0 &&
      !!form.dia_fechamento && !!form.dia_vencimento &&
      form.dia_fechamento >= 1 && form.dia_fechamento <= 31 &&
      form.dia_vencimento >= 1 && form.dia_vencimento <= 31;

  const handleSubmit = async () => {
    if (!valid) return;
    let payload = form;
    if (proximoVencimento) {
      const d = parseISO(proximoVencimento);
      payload = {
        ...form,
        dia_vencimento: d.getDate(),
        vencimento_anchor: proximoVencimento,
      };
    }
    await onSubmit(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cartao ? 'Editar Cartão' : 'Novo Cartão de Crédito'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome do Cartão *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Nubank Platinum"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input
                value={form.banco || ''}
                onChange={(e) => setForm(p => ({ ...p, banco: e.target.value }))}
                placeholder="Ex: Nubank"
              />
            </div>
            <div className="space-y-2">
              <Label>Bandeira</Label>
              <Select
                value={form.bandeira || ''}
                onValueChange={(v) => setForm(p => ({ ...p, bandeira: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {BANDEIRAS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Limite</Label>
            <Input
              type="number"
              step="0.01"
              value={form.limite ?? ''}
              onChange={(e) => setForm(p => ({ ...p, limite: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="0,00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Dia de Fechamento *</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.dia_fechamento ?? ''}
                onChange={(e) => setForm(p => ({ ...p, dia_fechamento: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="Ex: 3"
              />
            </div>
            <DatePickerField
              label={isNew ? 'Próximo vencimento *' : 'Próximo vencimento'}
              value={proximoVencimento || undefined}
              onChange={(d) => setProximoVencimento(d)}
              required={isNew}
            />
          </div>

          {!isNew && (
            <p className="text-xs text-muted-foreground -mt-2">
              Informe a data completa para recalcular os próximos vencimentos. Dia atual: {form.dia_vencimento ?? '—'}.
            </p>
          )}

          <div className="space-y-2">
            <Label>Conta padrão para pagamento</Label>
            <Select
              value={form.conta_pagamento_padrao_id || 'none'}
              onValueChange={(v) => setForm(p => ({ ...p, conta_pagamento_padrao_id: v === 'none' ? null : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {contasBancarias.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map(cor => (
                <button
                  key={cor}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition ${form.cor === cor ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: cor }}
                  onClick={() => setForm(p => ({ ...p, cor }))}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Cartão Ativo</Label>
            <Switch
              checked={form.ativa}
              onCheckedChange={(c) => setForm(p => ({ ...p, ativa: c }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!valid}>
            {cartao ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

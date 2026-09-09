import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { parseISO } from 'date-fns';
import type { ContaDB, ContaFormData } from '@/hooks/useContas';
import { BRANDS, BrandMark, brandByName } from '@/lib/cardBrands';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const CORES = ['#3B82F6', '#7A2EA8', '#0EA5A5', '#1F9E5A', '#F59E0B', '#EF4444', '#EC4899', '#334155'];

function cardFace(cor: string) {
  return {
    background: `linear-gradient(140deg, color-mix(in srgb, ${cor} 82%, #06070d) 0%, color-mix(in srgb, ${cor} 30%, #06070d) 52%, #080a12 100%)`,
    boxShadow: '0 14px 30px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
  } as const;
}

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle className="p-0 max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.55] backdrop-blur-2xl backdrop-saturate-[1.8] sm:max-w-[520px] sm:mx-auto">
        <div className="px-5 pt-1 pb-1">
          <div className="text-[11.5px] font-medium text-foreground-muted">Cadastro</div>
          <h2 className="mt-0.5 text-[22px] font-[670] tracking-[-0.02em] text-foreground">{cartao ? 'Editar cartão' : 'Novo cartão'}</h2>
        </div>

        <div className="space-y-4 px-5 pt-3">
          {/* Preview ao vivo do cartão (logo oficial + contraste automático) */}
          {(() => {
            const cor = form.cor || '#3a78cd';
            const b = brandByName(form.bandeira);
            return (
              <div className="relative overflow-hidden rounded-2xl p-4 text-white" style={cardFace(cor)}>
                {b && <div className="absolute top-3.5 right-4"><BrandMark brand={b} bg={cor} height={20} /></div>}
                <div className="text-sm font-semibold pr-16 truncate">{form.nome || 'Novo cartão'}</div>
                <div className="text-[11px] text-white/60 truncate pr-16">
                  {[b?.name, form.banco].filter(Boolean).join(' • ') || 'Seu banco'}
                </div>
                <div className="mt-4 font-mono tracking-[0.18em] text-white/80 text-sm">•••• •••• •••• ••••</div>
                <div className="mt-2 text-[10px] uppercase tracking-wide text-white/55">Limite</div>
                <div className="text-lg font-bold tabular-nums">{form.limite ? formatCurrency(Number(form.limite)) : 'R$ —'}</div>
              </div>
            );
          })()}

          <div className="space-y-2">
            <Label>Nome do Cartão *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Nubank Platinum"
            />
          </div>

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
            <div className="grid grid-cols-3 gap-2">
              {BRANDS.map((b) => {
                const on = form.bandeira === b.name;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, bandeira: on ? '' : b.name }))}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 h-[58px] rounded-xl border transition-colors',
                      on ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border/60 bg-surface/70 hover:border-border',
                    )}
                  >
                    {b.type === 'color' ? (
                      <span className="inline-flex items-center rounded bg-white/90 px-1 py-0.5"
                        dangerouslySetInnerHTML={{ __html: b.svg.replace('<svg', '<svg height="14" width="auto"') }} />
                    ) : (
                      <span className="inline-flex items-center text-foreground"
                        dangerouslySetInnerHTML={{ __html: b.svg.replace('<svg', '<svg height="14" width="auto"') }} />
                    )}
                    <span className="text-[9.5px] font-semibold text-foreground-muted">{b.name === 'American Express' ? 'Amex' : b.name}</span>
                  </button>
                );
              })}
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
            <Label>Cor do cartão</Label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map(cor => (
                <button
                  key={cor}
                  type="button"
                  aria-label={`Cor ${cor}`}
                  className={cn(
                    'w-9 h-9 rounded-[10px] transition-transform active:scale-95',
                    form.cor === cor ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'ring-1 ring-white/10',
                  )}
                  style={{ background: `linear-gradient(135deg, ${cor}, color-mix(in srgb, ${cor} 45%, #06070d))` }}
                  onClick={() => setForm(p => ({ ...p, cor }))}
                />
              ))}
            </div>
            <p className="text-[11px] text-foreground-muted">A cor vira um degradê no cartão. A logo da bandeira ajusta o contraste sozinha.</p>
          </div>

          <div className="flex items-center justify-between">
            <Label>Cartão Ativo</Label>
            <Switch
              checked={form.ativa}
              onCheckedChange={(c) => setForm(p => ({ ...p, ativa: c }))}
            />
          </div>
        </div>

        <div className="flex gap-2.5 px-5 py-5">
          <button onClick={() => onOpenChange(false)} className="flex-[0_0_34%] rounded-[14px] bg-surface-2 py-3 text-[13px] font-semibold text-foreground">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!valid} className="flex-1 rounded-[14px] bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] py-3 text-[13px] font-semibold text-white disabled:opacity-50">
            {cartao ? 'Salvar' : 'Criar cartão'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

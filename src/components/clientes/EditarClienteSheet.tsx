import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { maskCpfCnpj, onlyDigits } from '@/utils/formatters';
import type { ClienteDB, ClienteFormData } from '@/hooks/useClientes';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cliente: ClienteDB | null;
  onSalvar: (id: string, data: Partial<ClienteFormData>) => Promise<unknown>;
}

// Edição rápida do cadastro do cliente sem sair da tela de contratos.
export function EditarClienteSheet({ open, onOpenChange, cliente, onSalvar }: Props) {
  const [form, setForm] = useState<ClienteFormData>({ nome: '', tipo: 'PJ', status: 'ativo' });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open || !cliente) return;
    setForm({
      nome: cliente.nome || '',
      tipo: cliente.tipo || 'PJ',
      status: cliente.status || 'ativo',
      cpf_cnpj: cliente.cpf_cnpj || '',
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      endereco: cliente.endereco || '',
      empresa_fonte: cliente.empresa_fonte,
    });
  }, [open, cliente]);

  const set = (patch: Partial<ClienteFormData>) => setForm((p) => ({ ...p, ...patch }));

  const handleSalvar = async () => {
    if (!cliente || !form.nome.trim()) return;
    setSalvando(true);
    await onSalvar(cliente.id, form);
    setSalvando(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.97] backdrop-blur-2xl sm:max-w-[520px] sm:mx-auto">
        <div className="mx-auto w-full max-w-[480px] pb-6 pt-1">
          <p className="text-xs font-medium text-foreground-muted">Cadastro</p>
          <h2 className="mt-0.5 mb-4 text-[22px] font-semibold tracking-[-0.02em] text-foreground">Editar cliente</h2>

          <div className="space-y-3.5">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={form.nome} onChange={(e) => set({ nome: e.target.value })} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs">Tipo</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['PF', 'PJ'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => set({ tipo: t })}
                    className={cn('rounded-xl border py-2.5 text-sm font-semibold transition-colors', form.tipo === t ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted')}>
                    {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">{form.tipo === 'PJ' ? 'CNPJ' : 'CPF'}</Label>
              <Input
                inputMode="numeric"
                value={maskCpfCnpj(form.cpf_cnpj || '', form.tipo)}
                onChange={(e) => set({ cpf_cnpj: onlyDigits(e.target.value).slice(0, form.tipo === 'PJ' ? 14 : 11) })}
                placeholder={form.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                maxLength={form.tipo === 'PJ' ? 18 : 14}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.email || ''} onChange={(e) => set({ email: e.target.value })} placeholder="contato@…" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Telefone (WhatsApp)</Label>
                <Input value={form.telefone || ''} onChange={(e) => set({ telefone: e.target.value })} placeholder="(11) ..." className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Endereço</Label>
              <Input value={form.endereco || ''} onChange={(e) => set({ endereco: e.target.value })} placeholder="Rua, número, cidade - estado" className="mt-1" />
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['ativo', 'inativo'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => set({ status: s })}
                    className={cn('rounded-xl border py-2.5 text-sm font-semibold capitalize transition-colors', form.status === s ? 'border-transparent bg-primary text-white' : 'border-border/60 bg-surface/60 text-foreground-muted')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="button" className="flex-1" onClick={handleSalvar} disabled={salvando || !form.nome.trim()}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar cliente
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

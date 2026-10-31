import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { maskCpfCnpj, onlyDigits } from '@/utils/formatters';
import type { ClienteDB, ClienteFormData } from '@/hooks/useClientes';

const CHOICE_BASE = 'no-touch-min h-10 rounded-full border text-[13px] font-semibold transition-colors';
const CHOICE_ON = 'border-foreground bg-foreground text-background';
const CHOICE_OFF = 'border-border bg-surface text-foreground hover:border-border-strong';

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
      canal_cobranca: cliente.canal_cobranca || 'whatsapp',
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
      <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[520px] sm:mx-auto">
        <div className="mx-auto w-full max-w-[480px] pb-6 pt-1">
          <p className="text-[13px] text-foreground-muted">Cadastro</p>
          <h2 className="mt-0.5 mb-4 text-[24px] font-semibold tracking-[-0.03em] text-foreground">Editar cliente</h2>

          <div className="space-y-5">
            <FormSection title="Identificação">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => set({ nome: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['PF', 'PJ'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => set({ tipo: t })}
                      className={cn(CHOICE_BASE, form.tipo === t ? CHOICE_ON : CHOICE_OFF)}>
                      {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{form.tipo === 'PJ' ? 'CNPJ' : 'CPF'}</Label>
                <Input
                  inputMode="numeric"
                  value={maskCpfCnpj(form.cpf_cnpj || '', form.tipo)}
                  onChange={(e) => set({ cpf_cnpj: onlyDigits(e.target.value).slice(0, form.tipo === 'PJ' ? 14 : 11) })}
                  placeholder={form.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  maxLength={form.tipo === 'PJ' ? 18 : 14}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['ativo', 'inativo'] as const).map((s) => (
                    <button key={s} type="button" onClick={() => set({ status: s })}
                      className={cn(CHOICE_BASE, 'capitalize', form.status === s ? CHOICE_ON : CHOICE_OFF)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>

            <FormSection title="Contato">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-3">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email || ''} onChange={(e) => set({ email: e.target.value })} placeholder="contato@…" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone (WhatsApp)</Label>
                  <Input value={form.telefone || ''} onChange={(e) => set({ telefone: e.target.value })} placeholder="(11) ..." />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={form.endereco || ''} onChange={(e) => set({ endereco: e.target.value })} placeholder="Rua, número, cidade - estado" />
              </div>
            </FormSection>

            <FormSection title="Cobrança">
              <div className="space-y-2">
                <Label>Cobrança preferida por</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['ambos', 'Ambos']] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => set({ canal_cobranca: v })}
                      className={cn(CHOICE_BASE, (form.canal_cobranca || 'whatsapp') === v ? CHOICE_ON : CHOICE_OFF)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </FormSection>

            <div className="flex gap-2.5 pt-1">
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="button" size="lg" className="flex-[2]" onClick={handleSalvar} disabled={salvando || !form.nome.trim()}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}Salvar cliente
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">{title}</h3>
      <div className="space-y-3.5 rounded-[20px] border border-border p-4">{children}</div>
    </section>
  );
}

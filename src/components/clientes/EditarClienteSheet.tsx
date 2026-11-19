import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Campo, ModalFooter, ModalHeader, ModalShell, Secao } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { maskCpfCnpj, onlyDigits } from '@/utils/formatters';
import type { ClienteDB, ClienteFormData } from '@/hooks/useClientes';

const CHOICE_BASE = 'no-touch-min h-10 rounded-full border text-[13px] transition-colors';
const CHOICE_ON = 'border-foreground bg-foreground text-background';
const CHOICE_OFF = 'border-border bg-surface text-foreground hover:border-border-strong';

function Escolha<T extends string>({ v, atual, onPick, children }: { v: T; atual: T; onPick: (v: T) => void; children: React.ReactNode }) {
  return <button type="button" onClick={() => onPick(v)} aria-pressed={atual === v} className={cn(CHOICE_BASE, atual === v ? CHOICE_ON : CHOICE_OFF)}>{children}</button>;
}

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
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[600px]')}>
        <SheetTitle className="sr-only">Editar cliente</SheetTitle>
        <ModalShell>
          <ModalHeader eyebrow="Cadastro" title="Editar cliente" onClose={() => onOpenChange(false)} />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
            <Secao n={1} title="Identificação">
              <Campo label="Nome">
                <input value={form.nome} onChange={(e) => set({ nome: e.target.value })} className={campoCls} />
              </Campo>
              <Campo label="Tipo">
                <div className="grid grid-cols-2 gap-2">
                  {(['PF', 'PJ'] as const).map((t) => (
                    <Escolha key={t} v={t} atual={form.tipo} onPick={(v) => set({ tipo: v })}>{t === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}</Escolha>
                  ))}
                </div>
              </Campo>
              <Campo label={form.tipo === 'PJ' ? 'CNPJ' : 'CPF'}>
                <input
                  inputMode="numeric"
                  value={maskCpfCnpj(form.cpf_cnpj || '', form.tipo)}
                  onChange={(e) => set({ cpf_cnpj: onlyDigits(e.target.value).slice(0, form.tipo === 'PJ' ? 14 : 11) })}
                  placeholder={form.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  maxLength={form.tipo === 'PJ' ? 18 : 14}
                  className={campoCls}
                />
              </Campo>
              <Campo label="Situação">
                <div className="grid grid-cols-2 gap-2">
                  {(['ativo', 'inativo'] as const).map((st) => (
                    <Escolha key={st} v={st} atual={form.status} onPick={(v) => set({ status: v })}>{st === 'ativo' ? 'Ativo' : 'Inativo'}</Escolha>
                  ))}
                </div>
              </Campo>
            </Secao>

            <Secao n={2} title="Contato">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo label="E-mail">
                  <input type="email" value={form.email || ''} onChange={(e) => set({ email: e.target.value })} placeholder="contato@…" className={campoCls} />
                </Campo>
                <Campo label="Telefone (WhatsApp)">
                  <input type="tel" inputMode="tel" autoComplete="tel" value={form.telefone || ''} onChange={(e) => set({ telefone: e.target.value })} placeholder="(11) ..." className={campoCls} />
                </Campo>
              </div>
              <Campo label="Endereço">
                <input value={form.endereco || ''} onChange={(e) => set({ endereco: e.target.value })} placeholder="Rua, número, cidade - estado" className={campoCls} />
              </Campo>
            </Secao>

            <Secao n={3} title="Cobrança">
              <Campo label="Cobrança preferida por">
                <div className="grid grid-cols-3 gap-2">
                  {([['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['ambos', 'Ambos']] as const).map(([v, l]) => (
                    <Escolha key={v} v={v} atual={form.canal_cobranca || 'whatsapp'} onPick={(x) => set({ canal_cobranca: x })}>{l}</Escolha>
                  ))}
                </div>
              </Campo>
            </Secao>
          </div>
          <ModalFooter>
            <button type="button" onClick={() => onOpenChange(false)} className={btn.outline}>Cancelar</button>
            <button type="button" onClick={handleSalvar} disabled={salvando || !form.nome.trim()} className={btn.primary}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}Salvar cliente
            </button>
          </ModalFooter>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ParsedTransaction, Conta, ClienteOption } from './TransactionPreviewTable';
import type { Categoria } from '@/api/categorias';

const FORMA_PAGAMENTO_OPTIONS = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_debito', label: 'Cartão Débito' },
  { value: 'cartao_credito', label: 'Cartão Crédito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

interface TransactionEditModalProps {
  transaction: ParsedTransaction | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: ParsedTransaction) => void;
  categorias: Categoria[];
  contas: Conta[];
  clientes: ClienteOption[];
}

function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string | undefined;
  onChange: (val: string) => void;
  required?: boolean;
}) {
  const date = value ? parseISO(value) : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal h-9 text-sm',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {date ? format(date, 'dd/MM/yyyy') : 'Selecionar...'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[200]" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && onChange(format(d, 'yyyy-MM-dd'))}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function TransactionEditModal({
  transaction,
  open,
  onClose,
  onSave,
  categorias,
  contas,
  clientes,
}: TransactionEditModalProps) {
  const [form, setForm] = useState<ParsedTransaction | null>(null);

  useEffect(() => {
    if (transaction) {
      setForm({ ...transaction });
    }
  }, [transaction]);

  if (!form) return null;

  const isReceita = form.tipo === 'receita';

  const set = <K extends keyof ParsedTransaction>(field: K, value: ParsedTransaction[K]) => {
    setForm((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };

      // Reset tipo-specific fields when tipo changes
      if (field === 'tipo') {
        updated.categoria_id = undefined;
        updated.status = 'pendente';
        updated.data_recebimento = undefined;
        updated.data_pagamento = undefined;
      }

      // Auto-fill payment/receipt date when status changes
      if (field === 'status') {
        const dueDate = prev.data_vencimento || prev.data;
        if (value === 'recebido') {
          updated.data_recebimento = dueDate;
          updated.data_pagamento = undefined;
        } else if (value === 'pago') {
          updated.data_pagamento = dueDate;
          updated.data_recebimento = undefined;
        } else {
          updated.data_recebimento = undefined;
          updated.data_pagamento = undefined;
        }
      }

      return updated;
    });
  };

  const statusOptions = isReceita
    ? [
        { value: 'pendente', label: 'Pendente' },
        { value: 'recebido', label: 'Recebido' },
        { value: 'atrasado', label: 'Atrasado' },
      ]
    : [
        { value: 'pendente', label: 'Pendente' },
        { value: 'pago', label: 'Pago' },
        { value: 'atrasado', label: 'Atrasado' },
      ];

  const categoriasDoTipo = categorias.filter((c) => c.tipo === form.tipo);
  const isPago = form.status === 'pago' || form.status === 'recebido';

  const handleSave = () => {
    onSave({ ...form, reviewed: true } as ParsedTransaction & { reviewed: boolean });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Descrição + Valor + Tipo */}
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                Descrição <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.descricao}
                onChange={(e) => set('descricao', e.target.value)}
                placeholder="Descrição da transação"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  Valor (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => set('valor', parseFloat(e.target.value) || 0)}
                  className={isReceita ? 'text-emerald-600' : 'text-red-600'}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set('tipo', v as 'receita' | 'despesa')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">
                      <span className="text-emerald-600 font-medium">Receita</span>
                    </SelectItem>
                    <SelectItem value="despesa">
                      <span className="text-red-600 font-medium">Despesa</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Classificação */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Classificação</p>

            {categoriasDoTipo.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select
                  value={form.categoria_id || 'none'}
                  onValueChange={(v) => set('categoria_id', v === 'none' ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {categoriasDoTipo.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.cor }}
                          />
                          {cat.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {contas.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Conta</Label>
                <Select
                  value={form.conta_id || 'none'}
                  onValueChange={(v) => set('conta_id', v === 'none' ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {contas.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>
                        {conta.nome}
                        {conta.banco && (
                          <span className="text-muted-foreground ml-1">({conta.banco})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isReceita ? (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Cliente</Label>
                <Select
                  value={form.cliente_id || 'none'}
                  onValueChange={(v) => set('cliente_id', v === 'none' ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Fornecedor</Label>
                <Input
                  value={form.fornecedor || ''}
                  onChange={(e) => set('fornecedor', e.target.value)}
                  placeholder="Nome do fornecedor..."
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Status e Datas */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status e Datas</p>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={form.status || 'pendente'}
                onValueChange={(v) => set('status', v as ParsedTransaction['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DateField
                label="Data de Vencimento"
                value={form.data_vencimento || form.data}
                onChange={(v) => set('data_vencimento', v)}
                required
              />
              <DateField
                label="Data de Competência"
                value={form.data_competencia || form.data}
                onChange={(v) => set('data_competencia', v)}
              />
            </div>

            {isPago && (
              <DateField
                label={isReceita ? 'Data de Recebimento' : 'Data de Pagamento'}
                value={isReceita ? form.data_recebimento : form.data_pagamento}
                onChange={(v) =>
                  set(isReceita ? 'data_recebimento' : 'data_pagamento', v)
                }
              />
            )}
          </div>

          {/* Opções específicas */}
          {isReceita ? (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opções de Receita</p>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Forma de Pagamento</Label>
                  <Select
                    value={form.forma_pagamento || 'none'}
                    onValueChange={(v) => set('forma_pagamento', v === 'none' ? undefined : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {FORMA_PAGAMENTO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opções de Despesa</p>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Forma de Pagamento</Label>
                  <Select
                    value={form.forma_pagamento || 'none'}
                    onValueChange={(v) => set('forma_pagamento', v === 'none' ? undefined : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {FORMA_PAGAMENTO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Tipo de Despesa</Label>
                  <RadioGroup
                    value={form.tipo_despesa || 'variavel'}
                    onValueChange={(v) => set('tipo_despesa', v as 'fixa' | 'variavel')}
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="fixa" id="fixa" />
                      <Label htmlFor="fixa" className="text-sm font-normal cursor-pointer">Fixa</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="variavel" id="variavel" />
                      <Label htmlFor="variavel" className="text-sm font-normal cursor-pointer">Variável</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!form.descricao || form.valor <= 0}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

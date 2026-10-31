import { MoreHorizontal, Pencil, Trash2, Mail, Phone } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { EmpresaFonteBadge, type EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ClienteAvatar } from '@/components/clientes/ClienteAvatar';
import { formatPhone, formatCPFCNPJ } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { ClienteDB } from '@/hooks/useClientes';

interface ClienteCardProps {
  cliente: ClienteDB & { empresa_fonte?: EmpresaFonte | null };
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ClienteCard({ cliente, isSelected, onToggleSelect, onEdit, onDelete }: ClienteCardProps) {
  const stop = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } }}
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-[20px] border border-border bg-surface p-4 transition-colors md:p-5',
        'hover:border-border-strong',
        isSelected && 'border-foreground ring-1 ring-foreground',
      )}
    >
      {/* Topo: avatar + nome + seleção/ações */}
      <div className="flex items-start gap-3">
        <ClienteAvatar nome={cliente.nome} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground">{cliente.nome}</h3>
          <p className="mt-1 truncate text-[12px] text-foreground-muted">
            {cliente.tipo === 'PJ' ? 'Empresa' : 'Pessoa Física'}
            {cliente.cpf_cnpj && (
              <>
                {' · '}
                <span className="tabular-nums">{formatCPFCNPJ(cliente.cpf_cnpj)}</span>
              </>
            )}
          </p>
        </div>

        <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-1" onClick={stop}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Selecionar ${cliente.nome}`}
            className="opacity-0 transition-opacity group-hover:opacity-100 data-[state=checked]:opacity-100"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Ações"
                onClick={stop}
                className="no-touch-min inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={stop}>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-danger-fg focus:text-danger-fg">
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Contatos */}
      <div className="mt-4 min-h-[38px] space-y-1.5 text-[12.5px] text-foreground-muted">
        {cliente.email && (
          <div className="flex min-w-0 items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{cliente.email}</span>
          </div>
        )}
        {cliente.telefone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="tabular-nums">{formatPhone(cliente.telefone)}</span>
          </div>
        )}
        {!cliente.email && !cliente.telefone && (
          <span className="text-foreground-subtle">Sem contato cadastrado</span>
        )}
      </div>

      {/* Rodapé: marca + status */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        {cliente.empresa_fonte ? <EmpresaFonteBadge empresa={cliente.empresa_fonte} /> : <span />}
        <StatusBadge status={cliente.status} />
      </div>
    </div>
  );
}

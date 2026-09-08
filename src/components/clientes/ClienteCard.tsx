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

// Hash estável → tag color
const TAG_TOKENS = ['tag-blue', 'tag-violet', 'tag-teal', 'tag-amber', 'tag-pink', 'tag-green', 'tag-orange', 'tag-fuchsia'];
function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_TOKENS[h % TAG_TOKENS.length];
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function ClienteCard({ cliente, isSelected, onToggleSelect, onEdit, onDelete }: ClienteCardProps) {
  const tagToken = colorFromName(cliente.nome);
  const isAtivo = cliente.status === 'ativo';

  const stop = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } }}
      className={cn(
        'group relative flex flex-col rounded-xl border border-border bg-surface p-4 transition-all cursor-pointer',
        'hover:border-border-strong hover:shadow-xs',
        isSelected && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
      )}
    >
      {/* Top row: avatar + checkbox + actions */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
            style={{
              backgroundColor: `hsl(var(--${tagToken}) / 0.12)`,
              color: `hsl(var(--${tagToken}))`,
            }}
          >
            {initials(cliente.nome)}
          </div>
          <div className="min-w-0">
            {cliente.empresa_fonte && <EmpresaFonteBadge empresa={cliente.empresa_fonte} />}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={stop}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Selecionar ${cliente.nome}`}
            className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Ações"
                onClick={stop}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-foreground-muted hover:bg-surface-2 hover:text-foreground transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={stop}>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-danger-fg focus:text-danger-fg">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Nome */}
      <h3 className="font-semibold text-[15px] leading-tight text-foreground break-words">
        {cliente.nome}
      </h3>
      <p className="text-[11px] text-foreground-muted mt-0.5">
        {cliente.tipo === 'PJ' ? 'Empresa' : 'Pessoa Física'}
        {cliente.cpf_cnpj && (
          <>
            {' · '}
            <span className="font-mono">{formatCPFCNPJ(cliente.cpf_cnpj)}</span>
          </>
        )}
      </p>

      {/* Divider + status row */}
      <div className="my-3 border-t border-border-subtle" />

      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium',
            isAtivo ? 'bg-success-bg text-success-fg' : 'bg-surface-2 text-foreground-muted'
          )}
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full', isAtivo ? 'bg-success' : 'bg-foreground-subtle')}
          />
          {isAtivo ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Contatos — só renderiza se existir */}
      {(cliente.email || cliente.telefone) && (
        <div className="mt-3 space-y-1.5 text-xs text-foreground-muted">
          {cliente.email && (
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{cliente.email}</span>
            </div>
          )}
          {cliente.telefone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span className="font-mono">{formatPhone(cliente.telefone)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

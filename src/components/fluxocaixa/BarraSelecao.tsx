import { useState } from 'react';
import { ChevronDown, Download, Trash2, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

type Opcao = { value: string; label: string; color?: string };

interface BarraSelecaoProps {
  count: number;
  /** Soma com sinal (entradas − saídas) dos selecionados. */
  soma: number;
  onClear: () => void;
  statusOptions: Opcao[];
  onStatus: (v: string) => void;
  contaOptions: Opcao[];
  onConta: (v: string) => void;
  formaOptions: Opcao[];
  onForma: (v: string) => void;
  /** Só aparece quando a seleção é de um tipo só (receitas OU despesas). */
  categoriaOptions?: Opcao[];
  onCategoria?: (v: string) => void;
  clienteOptions?: Opcao[];
  onCliente?: (v: string) => void;
  showFornecedor?: boolean;
  onFornecedor?: (v: string) => void;
  onExport: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

const pill = 'inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-background/15 px-3 text-[12.5px] text-background transition-colors hover:bg-background/25 disabled:opacity-50';

function Menu({ rotulo, titulo, opcoes, onPick, disabled }: { rotulo: string; titulo: string; opcoes: Opcao[]; onPick: (v: string) => void; disabled?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={pill} disabled={disabled}>{rotulo}<ChevronDown className="h-3.5 w-3.5 opacity-70" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="max-h-72 w-56 overflow-y-auto rounded-2xl p-1.5">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">{titulo}</DropdownMenuLabel>
        {opcoes.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onPick(o.value)} className="gap-2 rounded-xl py-2 text-[13.5px]">
            {o.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} />}
            <span className="truncate">{o.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Barra escura de ações em massa do Fluxo de caixa. */
export function BarraSelecao(p: BarraSelecaoProps) {
  const [fornecedor, setFornecedor] = useState('');
  const [fornOpen, setFornOpen] = useState(false);
  if (p.count === 0) return null;
  const aplicarFornecedor = () => {
    if (!fornecedor.trim() || !p.onFornecedor) return;
    p.onFornecedor(fornecedor.trim());
    setFornecedor('');
    setFornOpen(false);
  };
  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 md:bottom-6">
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-full bg-foreground py-2 pl-4 pr-2 text-background shadow-2xl scrollbar-hide">
        <span className="whitespace-nowrap text-[13px] tabular-nums">
          {p.count} selecionado{p.count > 1 ? 's' : ''} · {p.soma < 0 ? '−' : ''}{formatCurrency(Math.abs(p.soma))}
        </span>
        <span className="mx-1 h-5 w-px shrink-0 bg-background/20" />
        <Menu rotulo="Dar baixa / status" titulo="Mudar status" opcoes={p.statusOptions} onPick={p.onStatus} disabled={p.disabled} />
        <Menu rotulo="Mudar conta" titulo="Conta" opcoes={p.contaOptions} onPick={p.onConta} disabled={p.disabled} />
        <Menu rotulo="Forma de pagamento" titulo="Forma de pagamento" opcoes={p.formaOptions} onPick={p.onForma} disabled={p.disabled} />
        {p.categoriaOptions && p.onCategoria && p.categoriaOptions.length > 0 && (
          <Menu rotulo="Categoria" titulo="Categoria" opcoes={p.categoriaOptions} onPick={p.onCategoria} disabled={p.disabled} />
        )}
        {p.clienteOptions && p.onCliente && p.clienteOptions.length > 0 && (
          <Menu rotulo="Cliente" titulo="Cliente" opcoes={p.clienteOptions} onPick={p.onCliente} disabled={p.disabled} />
        )}
        {p.showFornecedor && p.onFornecedor && (
          <Popover open={fornOpen} onOpenChange={setFornOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={pill} disabled={p.disabled}>Fornecedor<ChevronDown className="h-3.5 w-3.5 opacity-70" /></button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-64 rounded-2xl p-3">
              <p className="mb-2 text-[12.5px] text-foreground-muted">Nome do fornecedor</p>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: Meta Platforms" onKeyDown={(e) => { if (e.key === 'Enter') aplicarFornecedor(); }} />
              <button type="button" onClick={aplicarFornecedor} disabled={!fornecedor.trim()} className="mt-2 h-9 w-full rounded-full bg-foreground text-[13px] font-medium text-background disabled:opacity-40">Aplicar</button>
            </PopoverContent>
          </Popover>
        )}
        <button type="button" onClick={p.onExport} className={pill}><Download className="h-3.5 w-3.5" />Exportar</button>
        <button type="button" onClick={p.onDelete} disabled={p.disabled} className={cn(pill, 'bg-rose-500/80 hover:bg-rose-500')}><Trash2 className="h-3.5 w-3.5" />Excluir</button>
        <button type="button" onClick={p.onClear} aria-label="Limpar seleção" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-background/15"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

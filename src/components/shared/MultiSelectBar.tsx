import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Trash2, Download, CheckCircle, X, Tag, Truck, User, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiSelectAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

export interface StatusOption {
  value: string;
  label: string;
}

export interface CategoriaOption {
  value: string;
  label: string;
  color?: string;
}

export interface ClienteOption {
  value: string;
  label: string;
}

export interface ContaOption {
  value: string;
  label: string;
  color?: string;
}

interface MultiSelectBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  statusOptions?: StatusOption[];
  onStatusChange?: (status: string) => void;
  categoriaOptions?: CategoriaOption[];
  onCategoriaChange?: (categoriaId: string) => void;
  clienteOptions?: ClienteOption[];
  onClienteChange?: (clienteId: string) => void;
  contaOptions?: ContaOption[];
  onContaChange?: (contaId: string) => void;
  showFornecedor?: boolean;
  onFornecedorChange?: (fornecedor: string) => void;
  customActions?: MultiSelectAction[];
  className?: string;
}

export function MultiSelectBar({
  selectedCount,
  onClear,
  onDelete,
  onExport,
  statusOptions,
  onStatusChange,
  categoriaOptions,
  onCategoriaChange,
  clienteOptions,
  onClienteChange,
  contaOptions,
  onContaChange,
  showFornecedor,
  onFornecedorChange,
  customActions,
  className,
}: MultiSelectBarProps) {
  const [fornecedorInput, setFornecedorInput] = useState('');
  const [fornecedorPopoverOpen, setFornecedorPopoverOpen] = useState(false);

  if (selectedCount === 0) return null;

  const handleFornecedorSubmit = () => {
    if (fornecedorInput.trim() && onFornecedorChange) {
      onFornecedorChange(fornecedorInput.trim());
      setFornecedorInput('');
      setFornecedorPopoverOpen(false);
    }
  };

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
      "flex items-center gap-3 px-4 py-3 rounded-lg",
      "bg-background border border-border shadow-lg",
      "animate-in slide-in-from-bottom-4 fade-in duration-200",
      className
    )}>
      {/* Selection count */}
      <div className="flex items-center gap-2 pr-3 border-r border-border">
        <CheckCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={onClear}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Status change */}
      {statusOptions && onStatusChange && (
        <Select onValueChange={onStatusChange}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Alterar status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Categoria change */}
      {categoriaOptions && onCategoriaChange && (
        <Select onValueChange={onCategoriaChange}>
          <SelectTrigger className="w-[160px] h-9">
            <Tag className="h-3.5 w-3.5 mr-1.5 opacity-50" />
            <SelectValue placeholder="Alterar categoria" />
          </SelectTrigger>
          <SelectContent>
            {categoriaOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  {option.color && (
                    <div 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  {option.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Cliente change */}
      {clienteOptions && onClienteChange && (
        <Select onValueChange={onClienteChange}>
          <SelectTrigger className="w-[180px] h-9">
            <User className="h-3.5 w-3.5 mr-1.5 opacity-50" />
            <SelectValue placeholder="Alterar cliente" />
          </SelectTrigger>
          <SelectContent>
            {clienteOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Conta change */}
      {contaOptions && onContaChange && (
        <Select onValueChange={onContaChange}>
          <SelectTrigger className="w-[180px] h-9">
            <Wallet className="h-3.5 w-3.5 mr-1.5 opacity-50" />
            <SelectValue placeholder="Alterar conta" />
          </SelectTrigger>
          <SelectContent>
            {contaOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  {option.color && (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                  )}
                  {option.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}


      {/* Fornecedor change (for despesas) */}
      {showFornecedor && onFornecedorChange && (
        <Popover open={fornecedorPopoverOpen} onOpenChange={setFornecedorPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <Truck className="h-3.5 w-3.5" />
              Alterar fornecedor
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do fornecedor</label>
              <Input
                value={fornecedorInput}
                onChange={(e) => setFornecedorInput(e.target.value)}
                placeholder="Digite o nome..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleFornecedorSubmit();
                  }
                }}
              />
              <Button 
                size="sm" 
                className="w-full"
                onClick={handleFornecedorSubmit}
                disabled={!fornecedorInput.trim()}
              >
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Export button */}
      {onExport && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="gap-2 h-9"
        >
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      )}

      {/* Custom actions */}
      {customActions?.map((action, index) => (
        <Button
          key={index}
          variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
          size="sm"
          onClick={action.onClick}
          className="gap-2 h-9"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}

      {/* Delete button */}
      {onDelete && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          className="gap-2 h-9"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      )}
    </div>
  );
}

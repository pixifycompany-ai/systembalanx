import { useEffect, useState } from 'react';
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/formatters';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LinkedRow {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: 'entrada' | 'saida';
  table: 'receitas' | 'despesas';
}

interface Props {
  origemId: string;
  origemTipo: 'receita' | 'despesa';
  refreshKey?: number;
  onChanged?: () => void;
}

export function LinkedAuxiliaryList({ origemId, origemTipo, refreshKey = 0, onChanged }: Props) {
  const [rows, setRows] = useState<LinkedRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const col = origemTipo === 'receita' ? 'origem_receita_id' : 'origem_despesa_id';
      const [rec, des] = await Promise.all([
        supabase.from('receitas').select('id, descricao, valor, data_recebimento, data_vencimento').eq(col, origemId),
        supabase.from('despesas').select('id, descricao, valor, data_pagamento, data_vencimento').eq(col, origemId),
      ]);
      if (cancelled) return;
      const list: LinkedRow[] = [
        ...(rec.data || []).map((r: { id: string; descricao: string; valor: number; data_recebimento: string | null; data_vencimento: string }) => ({
          id: r.id,
          descricao: r.descricao,
          valor: Number(r.valor),
          data: r.data_recebimento || r.data_vencimento,
          tipo: 'entrada' as const,
          table: 'receitas' as const,
        })),
        ...(des.data || []).map((d: { id: string; descricao: string; valor: number; data_pagamento: string | null; data_vencimento: string }) => ({
          id: d.id,
          descricao: d.descricao,
          valor: Number(d.valor),
          data: d.data_pagamento || d.data_vencimento,
          tipo: 'saida' as const,
          table: 'despesas' as const,
        })),
      ].sort((a, b) => a.data.localeCompare(b.data));
      setRows(list);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [origemId, origemTipo, refreshKey]);

  const handleDelete = async (row: LinkedRow) => {
    const { error } = await supabase.from(row.table).delete().eq('id', row.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.filter(r => r.id !== row.id));
    toast({ title: 'Lançamento vinculado excluído' });
    onChanged?.();
  };

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <div className="rounded-[20px] border border-border bg-surface p-4">
      <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">
        Lançamentos vinculados ({rows.length})
      </p>
      <div className="divide-y divide-border">
        {rows.map(row => (
          <div key={`${row.table}-${row.id}`} className="flex items-center gap-2 py-2 text-[13px] first:pt-0 last:pb-0">
            {row.tipo === 'entrada' ? (
              <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--success-fg))] shrink-0" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-[hsl(var(--danger-fg))] shrink-0" />
            )}
            <span className="flex-1 truncate text-foreground">{row.descricao}</span>
            <span className="text-[12px] text-foreground-muted tabular-nums">
              {format(parseISO(row.data), 'dd/MM/yy', { locale: ptBR })}
            </span>
            <span className={cn(
              'text-sm font-medium tabular-nums shrink-0',
              row.tipo === 'entrada' ? 'text-[hsl(var(--success-fg))]' : 'text-[hsl(var(--danger-fg))]'
            )}>
              {row.tipo === 'entrada' ? '+' : '-'}{formatCurrency(row.valor)}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(row)}
              className="grid h-7 w-7 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-danger-bg hover:text-danger-fg"
              aria-label="Excluir lançamento vinculado"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

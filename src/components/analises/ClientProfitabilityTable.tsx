import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SectionCard } from '@/components/shared/SectionCard';
import { ScrollPills, Pill } from '@/components/shared/ScrollPills';
import { EmptyNote } from '@/components/relatorios/ReportKit';
import { ArrowDown, ArrowUp, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientProfitability } from '@/hooks/useAnalises';

interface ClientProfitabilityTableProps {
  clients: ClientProfitability[];
}

type SortKey = 'receitaTotal' | 'margemPercentual' | 'ltvCliente' | 'tempoRelacionamento';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'receitaTotal', label: 'Receita' },
  { key: 'margemPercentual', label: 'Margem' },
  { key: 'ltvCliente', label: 'LTV' },
  { key: 'tempoRelacionamento', label: 'Tempo' },
];

const marginTone = (m: number) =>
  m >= 40 ? 'text-[hsl(var(--success-fg))]' : m >= 20 ? 'text-[hsl(var(--warning-fg))]' : 'text-[hsl(var(--danger-fg))]';

export function ClientProfitabilityTable({ clients }: ClientProfitabilityTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('receitaTotal');
  const [sortDesc, setSortDesc] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const sortedClients = [...clients].sort((a, b) => {
    const multiplier = sortDesc ? -1 : 1;
    return (a[sortKey] - b[sortKey]) * multiplier;
  });

  const topClients = sortedClients.slice(0, 10);

  if (clients.length === 0) {
    return (
      <SectionCard title="Rentabilidade por Cliente">
        <EmptyNote>Nenhum cliente com dados de rentabilidade</EmptyNote>
      </SectionCard>
    );
  }

  const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;
  const DirIcon = sortDesc ? ArrowDown : ArrowUp;

  const Rank = ({ index }: { index: number }) => (
    <span
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums',
        index < 3 ? 'bg-info-bg text-info-fg' : 'bg-surface-2 text-foreground-muted',
      )}
    >
      {index + 1}
    </span>
  );

  const SortHead = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    const Icon = active ? DirIcon : ArrowUpDown;
    return (
      <TableHead>
        <button
          type="button"
          onClick={() => handleSort(k)}
          className={cn(
            'no-touch-min inline-flex h-8 items-center gap-1 rounded-full px-2.5 -ml-2.5 text-xs font-medium transition-colors hover:bg-surface-2',
            active ? 'text-foreground' : 'text-foreground-muted',
          )}
        >
          {label}
          <Icon className="h-3 w-3" />
        </button>
      </TableHead>
    );
  };

  return (
    <SectionCard flush className="overflow-hidden animate-fade-in" title="Rentabilidade por Cliente - Top 10">
      {/* Mobile: ordenação em chips + lista */}
      <div className="md:hidden">
        <ScrollPills className="mx-0 px-4 pb-3">
          {SORTS.map((s) => (
            <Pill key={s.key} active={sortKey === s.key} onClick={() => handleSort(s.key)}>
              {s.label}
              {sortKey === s.key && <DirIcon className="h-3 w-3" />}
            </Pill>
          ))}
        </ScrollPills>
        {topClients.map((client, index) => (
          <div key={client.clienteId} className="flex items-center gap-3 border-t border-border px-4 py-3">
            <Rank index={index} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{client.clienteNome}</p>
              <p className="mt-0.5 truncate text-[12px] text-foreground-muted">
                LTV {formatCurrency(client.ltvCliente)} · {meses(client.tempoRelacionamento)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-heading text-sm font-semibold tabular-nums text-foreground">{formatCurrency(client.receitaTotal)}</p>
              <p className={cn('mt-0.5 inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums', marginTone(client.margemPercentual))}>
                {client.margemPercentual >= 40 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {client.margemPercentual.toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabela com cabeçalhos ordenáveis */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-t border-border hover:bg-transparent">
              <TableHead className="w-64 pl-6">Cliente</TableHead>
              <SortHead k="receitaTotal" label="Receita" />
              <SortHead k="margemPercentual" label="Margem" />
              <SortHead k="ltvCliente" label="LTV" />
              <SortHead k="tempoRelacionamento" label="Tempo" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {topClients.map((client, index) => (
              <TableRow key={client.clienteId} className="border-border">
                <TableCell className="pl-6">
                  <div className="flex items-center gap-2.5">
                    <Rank index={index} />
                    <span className="max-w-[200px] truncate font-medium">{client.clienteNome}</span>
                  </div>
                </TableCell>
                <TableCell className="font-heading font-semibold tabular-nums">{formatCurrency(client.receitaTotal)}</TableCell>
                <TableCell>
                  <div className={cn('flex items-center gap-1 font-semibold tabular-nums', marginTone(client.margemPercentual))}>
                    {client.margemPercentual >= 40 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {client.margemPercentual.toFixed(1)}%
                  </div>
                </TableCell>
                <TableCell className="font-heading font-semibold tabular-nums">{formatCurrency(client.ltvCliente)}</TableCell>
                <TableCell className="pr-6 text-foreground-muted">{meses(client.tempoRelacionamento)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

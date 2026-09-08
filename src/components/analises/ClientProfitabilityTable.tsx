import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientProfitability } from '@/hooks/useAnalises';

interface ClientProfitabilityTableProps {
  clients: ClientProfitability[];
}

type SortKey = 'receitaTotal' | 'margemPercentual' | 'ltvCliente' | 'tempoRelacionamento';

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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Rentabilidade por Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Nenhum cliente com dados de rentabilidade
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Rentabilidade por Cliente - Top 10</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Cliente</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleSort('receitaTotal')}
                  >
                    Receita
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleSort('margemPercentual')}
                  >
                    Margem
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleSort('ltvCliente')}
                  >
                    LTV
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => handleSort('tempoRelacionamento')}
                  >
                    Tempo
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topClients.map((client, index) => (
                <TableRow key={client.clienteId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                        index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                        index === 1 ? "bg-gray-400/20 text-gray-500" :
                        index === 2 ? "bg-orange-500/20 text-orange-600" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </span>
                      <span className="font-medium truncate max-w-[160px]">{client.clienteNome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(client.receitaTotal)}</TableCell>
                  <TableCell>
                    <div className={cn(
                      "flex items-center gap-1",
                      client.margemPercentual >= 40 ? "text-green-500" :
                      client.margemPercentual >= 20 ? "text-yellow-500" :
                      "text-red-500"
                    )}>
                      {client.margemPercentual >= 40 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {client.margemPercentual.toFixed(1)}%
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(client.ltvCliente)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.tempoRelacionamento} {client.tempoRelacionamento === 1 ? 'mês' : 'meses'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

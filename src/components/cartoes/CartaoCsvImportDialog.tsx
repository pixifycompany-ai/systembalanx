import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDespesas, type CategoriaDB } from '@/hooks/useDespesas';
import { parseCardCsv } from '@/utils/cardCsvParser';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { ContaDB } from '@/hooks/useContas';

interface CartaoCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartao: ContaDB;
  onImportComplete?: () => void;
}

interface PreviewRow {
  id: string;
  selected: boolean;
  data: string;
  descricao: string;
  valor: number;
  fornecedor: string;
  categoria_id: string;
  tipo_despesa: 'fixa' | 'variavel';
}

type Step = 'upload' | 'processing' | 'preview' | 'importing' | 'done';

export function CartaoCsvImportDialog({
  open,
  onOpenChange,
  cartao,
  onImportComplete,
}: CartaoCsvImportDialogProps) {
  const { toast } = useToast();
  const { categorias, createDespesa } = useDespesas();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);

  const despesaCategorias = categorias.filter((c: CategoriaDB) => c.tipo === 'despesa');

  const reset = () => {
    setStep('upload');
    setError(null);
    setRows([]);
    setProgress(0);
    setImported(0);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setStep('processing');
      try {
        const text = await file.text();
        const { rows: parsed, warning } = parseCardCsv(text);
        if (warning || parsed.length === 0) {
          setError(warning || 'Não foi possível extrair lançamentos do CSV.');
          setStep('upload');
          return;
        }

        // AI enrichment
        const catInput = despesaCategorias.map(c => ({ id: c.id, nome: c.nome }));
        const { data, error: fnError } = await supabase.functions.invoke('enrich-card-csv', {
          body: { rows: parsed, categorias: catInput },
        });

        const enrichedMap = new Map<number, any>();
        if (!fnError && data?.enriched) {
          for (const e of data.enriched) enrichedMap.set(e.index, e);
        }

        const preview: PreviewRow[] = parsed.map(r => {
          const e = enrichedMap.get(r.index);
          return {
            id: `r-${r.index}`,
            selected: true,
            data: r.data,
            descricao: r.descricao,
            valor: r.valor,
            fornecedor: e?.fornecedor || '',
            categoria_id: e?.categoria_id || '',
            tipo_despesa: e?.tipo_despesa || 'variavel',
          };
        });

        setRows(preview);
        setStep('preview');
      } catch (err) {
        console.error('CSV import error:', err);
        setError(err instanceof Error ? err.message : 'Erro ao processar CSV');
        setStep('upload');
      }
    },
    [despesaCategorias]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    if (inputRef.current) inputRef.current.value = '';
  };

  const updateRow = (id: string, patch: Partial<PreviewRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const toggleAll = () => {
    const allSel = rows.every(r => r.selected);
    setRows(prev => prev.map(r => ({ ...r, selected: !allSel })));
  };

  const handleImport = async () => {
    const selected = rows.filter(r => r.selected);
    if (selected.length === 0) {
      toast({ title: 'Nenhum lançamento selecionado', variant: 'destructive' });
      return;
    }
    setStep('importing');
    setProgress(0);
    setImported(0);

    let count = 0;
    for (const r of selected) {
      try {
        const result = await createDespesa(
          {
            descricao: r.descricao,
            valor: r.valor,
            data_competencia: r.data,
            data_vencimento: r.data,
            categoria_id: r.categoria_id || undefined,
            fornecedor: r.fornecedor || undefined,
            conta_id: cartao.id,
            tipo: r.tipo_despesa,
            status: 'pendente',
          },
          true
        );
        if (result.success) count++;
      } catch (err) {
        console.error('Failed to import row', r, err);
      }
      setProgress(((count) / selected.length) * 100);
      setImported(count);
    }

    setStep('done');
    onImportComplete?.();
    toast({ title: `${count} lançamentos importados!` });
  };

  const allSelected = rows.length > 0 && rows.every(r => r.selected);
  const selectedCount = rows.filter(r => r.selected).length;
  const totalSelected = rows.filter(r => r.selected).reduce((s, r) => s + r.valor, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(o))}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Importar CSV — {cartao.nome}
          </DialogTitle>
          <DialogDescription>
            Faça upload do CSV exportado do banco. A IA categoriza e identifica os fornecedores automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition',
              dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Arraste o CSV aqui ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">Aceita CSV de Nubank, Itaú, Bradesco, Inter, C6 e similares</p>
            {error && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="py-10 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
            <p className="font-medium">Analisando CSV e categorizando com IA…</p>
            <p className="text-xs text-muted-foreground mt-1">Isso pode levar alguns segundos.</p>
          </div>
        )}

        {step === 'preview' && (
          <>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="w-10 px-2 py-2">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                      </th>
                      <th className="px-2 py-2 text-left">Data</th>
                      <th className="px-2 py-2 text-left">Descrição</th>
                      <th className="px-2 py-2 text-left">Fornecedor</th>
                      <th className="px-2 py-2 text-left">Categoria</th>
                      <th className="px-2 py-2 text-left">Tipo</th>
                      <th className="px-2 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-1.5">
                          <Checkbox
                            checked={r.selected}
                            onCheckedChange={() => updateRow(r.id, { selected: !r.selected })}
                          />
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                          {r.data.split('-').reverse().join('/')}
                        </td>
                        <td className="px-2 py-1.5 max-w-[200px] truncate" title={r.descricao}>
                          {r.descricao}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            value={r.fornecedor}
                            onChange={(e) => updateRow(r.id, { fornecedor: e.target.value })}
                            className="h-8 text-xs"
                            placeholder="Fornecedor"
                          />
                        </td>
                        <td className="px-2 py-1.5 min-w-[150px]">
                          <Select
                            value={r.categoria_id || 'none'}
                            onValueChange={(v) => updateRow(r.id, { categoria_id: v === 'none' ? '' : v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Sem categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem categoria</SelectItem>
                              {despesaCategorias.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Select
                            value={r.tipo_despesa}
                            onValueChange={(v: 'fixa' | 'variavel') => updateRow(r.id, { tipo_despesa: v })}
                          >
                            <SelectTrigger className="h-8 text-xs w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="variavel">Variável</SelectItem>
                              <SelectItem value="fixa">Fixa</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium whitespace-nowrap">
                          {formatCurrency(r.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-3 items-center">
                <Badge variant="secondary">{selectedCount} de {rows.length} selecionados</Badge>
                <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{formatCurrency(totalSelected)}</span></span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Importar {selectedCount} lançamentos
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'importing' && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-2" />
              <p className="font-medium">Importando lançamentos…</p>
              <p className="text-xs text-muted-foreground">{imported} de {rows.filter(r => r.selected).length}</p>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <div>
              <p className="font-semibold">{imported} lançamentos importados!</p>
              <p className="text-xs text-muted-foreground">Os valores foram adicionados à fatura do cartão.</p>
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

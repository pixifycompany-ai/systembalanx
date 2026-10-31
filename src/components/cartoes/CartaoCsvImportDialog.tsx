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
          <p className="text-[13px] text-foreground-muted">Importar CSV · IA</p>
          <DialogTitle className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.03em]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-surface-2 text-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="truncate">{cartao.nome}</span>
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
              'cursor-pointer rounded-[20px] border-2 border-dashed p-8 text-center transition-colors md:p-10',
              dragActive ? 'border-primary bg-info-bg' : 'border-border bg-surface hover:border-border-strong'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-[14px] bg-surface-2 text-foreground">
              <Upload className="h-5 w-5" />
            </span>
            <p className="font-semibold text-foreground">Arraste o CSV aqui ou clique para selecionar</p>
            <p className="mt-1 text-[12px] text-foreground-muted">Aceita CSV de Nubank, Itaú, Bradesco, Inter, C6 e similares</p>
            {error && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[hsl(var(--danger-fg))]">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="py-10 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
            <p className="font-semibold text-foreground">Analisando CSV e categorizando com IA…</p>
            <p className="mt-1 text-[12px] text-foreground-muted">Isso pode levar alguns segundos.</p>
          </div>
        )}

        {step === 'preview' && (
          <>
            <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-surface-2 text-[12px] text-foreground-muted">
                    <tr>
                      <th className="w-10 px-3 py-2.5">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                      </th>
                      <th className="px-3 py-2.5 font-medium text-left">Data</th>
                      <th className="px-3 py-2.5 font-medium text-left">Descrição</th>
                      <th className="px-3 py-2.5 font-medium text-left">Fornecedor</th>
                      <th className="px-3 py-2.5 font-medium text-left">Categoria</th>
                      <th className="px-3 py-2.5 font-medium text-left">Tipo</th>
                      <th className="px-3 py-2.5 font-medium text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={r.selected}
                            onCheckedChange={() => updateRow(r.id, { selected: !r.selected })}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {r.data.split('-').reverse().join('/')}
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={r.descricao}>
                          {r.descricao}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={r.fornecedor}
                            onChange={(e) => updateRow(r.id, { fornecedor: e.target.value })}
                            className="h-8 text-xs"
                            placeholder="Fornecedor"
                          />
                        </td>
                        <td className="px-3 py-2 min-w-[150px]">
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
                        <td className="px-3 py-2">
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
                        <td className="px-3 py-2 text-right font-heading font-semibold tabular-nums whitespace-nowrap">
                          {formatCurrency(r.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-muted">{selectedCount} de {rows.length} selecionados</span>
                <span className="text-foreground-muted">Total: <span className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(totalSelected)}</span></span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                <FileSpreadsheet className="h-4 w-4" />
                Importar {selectedCount} lançamentos
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'importing' && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-2" />
              <p className="font-semibold text-foreground">Importando lançamentos…</p>
              <p className="text-[12px] text-foreground-muted">{imported} de {rows.filter(r => r.selected).length}</p>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center space-y-3">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-bg text-success-fg">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold">{imported} lançamentos importados!</p>
              <p className="text-[12px] text-foreground-muted">Os valores foram adicionados à fatura do cartão.</p>
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { ModalFooter, ModalHeader, ModalShell } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';
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
        if (parsed.length === 0) {
          setError(warning || 'Não foi possível extrair lançamentos do CSV.');
          setStep('upload');
          return;
        }
        // Aviso que não impede a importação (ex.: estornos deixados de fora).
        if (warning) toast({ title: 'Atenção', description: warning });

        // AI enrichment
        const catInput = despesaCategorias.map(c => ({ id: c.id, nome: c.nome }));
        const { data, error: fnError } = await supabase.functions.invoke('enrich-card-csv', {
          body: { rows: parsed, categorias: catInput },
        });

        type Enriquecido = { index: number; fornecedor?: string; categoria_id?: string; tipo_despesa?: 'fixa' | 'variavel' };
        const enrichedMap = new Map<number, Enriquecido>();
        if (!fnError && data?.enriched) {
          for (const e of data.enriched as Enriquecido[]) enrichedMap.set(e.index, e);
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
    [despesaCategorias, toast]
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

  const mini = 'h-9 w-full rounded-xl border border-input bg-surface-2 px-2.5 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-ring';

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(o))}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[860px]')}>
        <SheetTitle className="sr-only">Importar CSV do cartão {cartao.nome}</SheetTitle>
        <ModalShell>
          <ModalHeader eyebrow={`${cartao.nome} · ${step === 'preview' ? 'passo 2 de 2 · revise antes de importar' : step === 'done' ? 'concluído' : 'passo 1 de 2 · envie o CSV'}`} title="Importar CSV do cartão" onClose={handleClose} />
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
            {step === 'upload' && (
              <div className="space-y-3">
                <div
                  onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-3 rounded-[24px] border-2 border-dashed px-6 py-10 text-center transition-colors',
                    dragActive ? 'border-primary bg-info-bg' : 'border-border-strong bg-surface hover:bg-surface-2/50',
                  )}
                >
                  <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelect} />
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-foreground"><Upload className="h-6 w-6" /></span>
                  <span className="text-[15px] font-medium text-foreground">Arraste o CSV aqui ou toque para escolher</span>
                  <span className="text-[12.5px] text-foreground-muted">Aceita CSV de Nubank, Itaú, Bradesco, Inter, C6 e similares</span>
                  {error && <span className="flex items-center gap-2 text-[13px] text-danger-fg"><AlertCircle className="h-4 w-4" /> {error}</span>}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    [<FileSpreadsheet key="a" className="h-4 w-4" />, 'CSV do banco', 'Exporte a fatura no app do banco'],
                    [<Sparkles key="b" className="h-4 w-4" />, 'Lido pela IA', 'Fornecedor e categoria sugeridos'],
                    [<CheckCircle2 key="c" className="h-4 w-4" />, 'Você revisa', 'Nada é salvo antes de confirmar'],
                  ].map(([ic, t, d]) => (
                    <div key={t as string} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-foreground-muted">{ic}</span>
                      <span><span className="block text-[13px] text-foreground">{t}</span><span className="block text-[11.5px] text-foreground-muted">{d}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="flex flex-col items-center gap-3 rounded-[24px] border border-border bg-surface px-6 py-12 text-center">
                <span className="iara-brilho grid h-14 w-14 place-items-center rounded-full bg-foreground text-background"><Sparkles className="h-6 w-6" /></span>
                <span className="text-[15px] font-medium text-foreground">Analisando o CSV e categorizando com IA…</span>
                <span className="text-[12.5px] text-foreground-muted">Isso pode levar alguns segundos.</span>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2/70 px-3.5 py-2.5 text-[13px]">
                  <label className="flex items-center gap-2 text-foreground"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" />{selectedCount} de {rows.length} selecionados</label>
                  <span className="text-foreground-muted">Total <b className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(totalSelected)}</b></span>
                </div>
                <div className="divide-y divide-border rounded-[20px] border border-border bg-surface">
                  {rows.map((r) => (
                    <div key={r.id} className={cn('space-y-2 px-4 py-3', !r.selected && 'opacity-55')}>
                      <div className="flex items-center gap-3">
                        <Checkbox checked={r.selected} onCheckedChange={() => updateRow(r.id, { selected: !r.selected })} aria-label={`Selecionar ${r.descricao}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-foreground" title={r.descricao}>{r.descricao}</span>
                          <span className="block text-[12px] text-foreground-muted">{r.data.split('-').reverse().join('/')}</span>
                        </span>
                        <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(r.valor)}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 pl-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]">
                        <input value={r.fornecedor} onChange={(e) => updateRow(r.id, { fornecedor: e.target.value })} placeholder="Fornecedor" aria-label="Fornecedor" className={mini} />
                        <select value={r.categoria_id} onChange={(e) => updateRow(r.id, { categoria_id: e.target.value })} aria-label="Categoria" className={mini}>
                          <option value="">Sem categoria</option>
                          {despesaCategorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                        <select value={r.tipo_despesa} onChange={(e) => updateRow(r.id, { tipo_despesa: e.target.value as 'fixa' | 'variavel' })} aria-label="Tipo de despesa" className={mini}>
                          <option value="variavel">Variável</option>
                          <option value="fixa">Fixa</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="space-y-4 rounded-[24px] border border-border bg-surface px-6 py-10 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-foreground" />
                <div>
                  <p className="text-[15px] font-medium text-foreground">Importando lançamentos…</p>
                  <p className="text-[12.5px] text-foreground-muted">{imported} de {rows.filter((r) => r.selected).length}</p>
                </div>
                <Progress value={progress} />
              </div>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-center gap-3 rounded-[24px] border border-border bg-surface px-6 py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-success-bg text-success-fg"><CheckCircle2 className="h-7 w-7" /></span>
                <p className="text-[15px] font-medium text-foreground">{imported} lançamentos importados!</p>
                <p className="text-[12.5px] text-foreground-muted">Os valores foram adicionados à fatura do cartão.</p>
              </div>
            )}
          </div>

          <ModalFooter left={step === 'preview' ? <button type="button" onClick={reset} className={btn.ghost}>Trocar arquivo</button> : undefined}>
            {step === 'done' ? (
              <button type="button" onClick={handleClose} className={btn.primary}>Fechar</button>
            ) : (
              <>
                <button type="button" onClick={handleClose} disabled={step === 'importing'} className={btn.outline}>Cancelar</button>
                {step === 'preview' && (
                  <button type="button" onClick={handleImport} disabled={selectedCount === 0} className={btn.primary}>
                    <FileSpreadsheet className="h-4 w-4" />Importar {selectedCount}
                  </button>
                )}
              </>
            )}
          </ModalFooter>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}

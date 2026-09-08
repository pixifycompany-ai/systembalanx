import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, FileImage, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Image } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { TransactionPreviewTable, type ParsedTransaction, type PairedTransfer } from './TransactionPreviewTable';
import { TransactionEditModal } from './TransactionEditModal';
import { useClientes } from '@/hooks/useClientes';
import { useToast } from '@/hooks/use-toast';
import { useContas } from '@/hooks/useContas';
import { useDuplicateDetection } from '@/hooks/useDuplicateDetection';
import { fetchCategorias, type Categoria } from '@/api/categorias';
import { cn } from '@/lib/utils';

interface FileImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type ImportStep = 'upload' | 'processing' | 'preview' | 'importing' | 'complete';

interface FileProcessingStatus {
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  transactionCount?: number;
  error?: string;
}

const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

const ACCEPTED_EXTENSIONS = '.csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_IMAGES = 10;

export function FileImportDialog({ open, onOpenChange, onImportComplete }: FileImportDialogProps) {
  const { toast } = useToast();
  const { contas } = useContas();
  const { clientes } = useClientes();
  const { checkBatch } = useDuplicateDetection();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<ImportStep>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [fileStatuses, setFileStatuses] = useState<FileProcessingStatus[]>([]);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [pairedTransfers, setPairedTransfers] = useState<PairedTransfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ receitas: number; despesas: number; transferencias: number } | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<ParsedTransaction | null>(null);

  // Load categories
  useEffect(() => {
    if (open) {
      fetchCategorias().then(setCategorias).catch(console.error);
    }
  }, [open]);

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setMultipleFiles([]);
    setFileStatuses([]);
    setTransactions([]);
    setPairedTransfers([]);
    setError(null);
    setImportProgress(0);
    setImportResult(null);
    setEditingTransaction(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  // Match category by name (fallback for non-AI)
  const matchCategory = useCallback((sugestao: string, tipo: 'receita' | 'despesa'): string | undefined => {
    if (!sugestao || categorias.length === 0) return undefined;
    
    const categoriasDoTipo = categorias.filter(c => c.tipo === tipo);
    const lowerSugestao = sugestao.toLowerCase().trim();
    
    const exactMatch = categoriasDoTipo.find(c => c.nome.toLowerCase() === lowerSugestao);
    if (exactMatch) return exactMatch.id;
    
    const partialMatch = categoriasDoTipo.find(c => 
      c.nome.toLowerCase().includes(lowerSugestao) || lowerSugestao.includes(c.nome.toLowerCase())
    );
    return partialMatch?.id;
  }, [categorias]);

  // AI-powered categorization
  const aiCategorize = useCallback(async (transactions: ParsedTransaction[]): Promise<ParsedTransaction[]> => {
    if (categorias.length === 0 || transactions.length === 0) return transactions;

    try {
      const txInput = transactions
        .filter(t => !t.is_transfer && !t.ignorar)
        .map((t, i) => ({ index: i, descricao: t.descricao, valor: t.valor, tipo: t.tipo }));

      if (txInput.length === 0) return transactions;

      const catInput = categorias.map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo }));

      const { data, error } = await supabase.functions.invoke('categorize-transactions', {
        body: { transactions: txInput, categorias: catInput },
      });

      if (error || !data?.suggestions) {
        console.warn('AI categorization failed, using fallback:', error);
        return transactions;
      }

      // Build index → categoria_id map
      const suggestionMap = new Map<number, string>();
      for (const s of data.suggestions) {
        suggestionMap.set(s.index, s.categoria_id);
      }

      // Apply suggestions to non-transfer transactions
      let aiIndex = 0;
      return transactions.map(t => {
        if (t.is_transfer || t.ignorar) return t;
        const catId = suggestionMap.get(aiIndex);
        aiIndex++;
        if (catId && !t.categoria_id) {
          return { ...t, categoria_id: catId };
        }
        return t;
      });
    } catch (err) {
      console.warn('AI categorization error:', err);
      return transactions;
    }
  }, [categorias]);

  // Process multiple image files
  const processMultipleImages = async (files: File[]) => {
    setMultipleFiles(files);
    setStep('processing');
    setError(null);

    const initialStatuses: FileProcessingStatus[] = files.map(f => ({
      name: f.name,
      status: 'pending',
    }));
    setFileStatuses(initialStatuses);

    try {
      // Convert all files to base64
      const fileContents = await Promise.all(files.map(async (f) => {
        const arrayBuffer = await f.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return {
          content: btoa(binary),
          type: f.type || 'image/jpeg',
          name: f.name,
        };
      }));

      // Update status to processing for first file
      setFileStatuses(prev => prev.map((s, i) => 
        i === 0 ? { ...s, status: 'processing' } : s
      ));

      // Send all files to edge function
      const { data, error: fnError } = await supabase.functions.invoke('parse-transactions', {
        body: { files: fileContents },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Failed to parse files');
      }

      // Update all statuses to done
      const transactionsByFile = new Map<string, number>();
      data.transactions.forEach((t: any) => {
        const count = transactionsByFile.get(t.source_file) || 0;
        transactionsByFile.set(t.source_file, count + 1);
      });

      setFileStatuses(files.map(f => ({
        name: f.name,
        status: 'done',
        transactionCount: transactionsByFile.get(f.name) || 0,
      })));

      // Process transactions with IDs and match categories
      let parsedTransactions: ParsedTransaction[] = data.transactions.map((t: any, index: number) => {
        const categoriaId = matchCategory(t.categoria_sugerida, t.tipo);
        return {
          ...t,
          id: `tx-${index}-${Date.now()}`,
          selected: !t.ignorar && !t.is_transfer,
          categoria_id: categoriaId,
        };
      });

      // AI categorization for items without category
      parsedTransactions = await aiCategorize(parsedTransactions);

      // Check for duplicates
      const nonTransferTransactions = parsedTransactions.filter(t => !t.is_transfer && !t.ignorar);
      const duplicateResults = await checkBatch(
        nonTransferTransactions.map(t => ({
          data: t.data,
          valor: t.valor,
          descricao: t.descricao,
          tipo: t.tipo,
        }))
      );

      // Apply duplicate info
      const transactionsWithDuplicates = parsedTransactions.map(t => {
        if (t.is_transfer || t.ignorar) return t;
        const duplicateInfo = duplicateResults.find(
          d => d.data === t.data && d.valor === t.valor && d.descricao === t.descricao
        );
        if (duplicateInfo?.isDuplicate) {
          return {
            ...t,
            isDuplicate: true,
            duplicateMatch: duplicateInfo.duplicateMatch,
            selected: false,
          };
        }
        return t;
      });

      // Process paired transfers
      const transfers: PairedTransfer[] = (data.paired_transfers || []).map((pair: any, index: number) => ({
        id: `transfer-${index}-${Date.now()}`,
        enviada: { ...pair.enviada, id: `env-${index}` },
        recebida: { ...pair.recebida, id: `rec-${index}` },
        selected: true,
      }));

      setTransactions(transactionsWithDuplicates);
      setPairedTransfers(transfers);
      setStep('preview');
    } catch (err) {
      console.error('Error processing files:', err);
      setError(err instanceof Error ? err.message : 'Failed to process files');
      setFileStatuses(prev => prev.map(s => ({ ...s, status: 'error' })));
      setStep('upload');
    }
  };

  const processSingleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setStep('processing');
    setError(null);

    try {
      let fileContent: string;
      const fileType = selectedFile.type || (selectedFile.name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
      
      if (fileType.includes('csv') || fileType === 'text/plain') {
        fileContent = await selectedFile.text();
      } else {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        fileContent = btoa(binary);
      }

      const { data, error: fnError } = await supabase.functions.invoke('parse-transactions', {
        body: {
          file_content: fileContent,
          file_type: fileType,
          file_name: selectedFile.name,
        },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Failed to parse file');
      }

      let parsedTransactions: ParsedTransaction[] = data.transactions.map((t: any, index: number) => {
        const categoriaId = matchCategory(t.categoria_sugerida, t.tipo);
        return {
          ...t,
          id: `tx-${index}-${Date.now()}`,
          selected: !t.ignorar && !t.is_transfer,
          categoria_id: categoriaId,
        };
      });

      // AI categorization for items without category
      parsedTransactions = await aiCategorize(parsedTransactions);

      // Check for duplicates
      const nonTransferTransactions = parsedTransactions.filter(t => !t.is_transfer && !t.ignorar);
      const duplicateResults = await checkBatch(
        nonTransferTransactions.map(t => ({
          data: t.data,
          valor: t.valor,
          descricao: t.descricao,
          tipo: t.tipo,
        }))
      );

      const transactionsWithDuplicates = parsedTransactions.map(t => {
        if (t.is_transfer || t.ignorar) return t;
        const duplicateInfo = duplicateResults.find(
          d => d.data === t.data && d.valor === t.valor && d.descricao === t.descricao
        );
        if (duplicateInfo?.isDuplicate) {
          return {
            ...t,
            isDuplicate: true,
            duplicateMatch: duplicateInfo.duplicateMatch,
            selected: false,
          };
        }
        return t;
      });

      const transfers: PairedTransfer[] = (data.paired_transfers || []).map((pair: any, index: number) => ({
        id: `transfer-${index}-${Date.now()}`,
        enviada: { ...pair.enviada, id: `env-${index}` },
        recebida: { ...pair.recebida, id: `rec-${index}` },
        selected: true,
      }));

      setTransactions(transactionsWithDuplicates);
      setPairedTransfers(transfers);
      setStep('preview');
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setStep('upload');
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    // Check if all files are images
    const imageFiles = droppedFiles.filter(f => IMAGE_TYPES.includes(f.type));
    
    if (imageFiles.length > 1 && imageFiles.length <= MAX_IMAGES) {
      // Multiple images mode
      processMultipleImages(imageFiles);
    } else if (droppedFiles.length === 1) {
      // Single file mode
      processSingleFile(droppedFiles[0]);
    } else if (imageFiles.length > MAX_IMAGES) {
      setError(`Máximo de ${MAX_IMAGES} imagens permitidas por vez.`);
    } else {
      setError('Para múltiplos arquivos, selecione apenas imagens (PNG, JPG).');
    }
  }, [matchCategory]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;
    
    // Check if all files are images
    const imageFiles = selectedFiles.filter(f => IMAGE_TYPES.includes(f.type));
    
    if (imageFiles.length > 1 && imageFiles.length <= MAX_IMAGES) {
      processMultipleImages(imageFiles);
    } else if (selectedFiles.length === 1) {
      processSingleFile(selectedFiles[0]);
    } else if (imageFiles.length > MAX_IMAGES) {
      setError(`Máximo de ${MAX_IMAGES} imagens permitidas por vez.`);
    } else {
      setError('Para múltiplos arquivos, selecione apenas imagens (PNG, JPG).');
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [matchCategory]);

  const toggleSelect = useCallback((id: string) => {
    setTransactions(prev => 
      prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t)
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    const selectableTransactions = transactions.filter(t => !t.ignorar && !t.is_transfer);
    const allSelected = selectableTransactions.every(t => t.selected);
    
    setTransactions(prev =>
      prev.map(t => (t.ignorar || t.is_transfer) ? t : { ...t, selected: !allSelected })
    );
  }, [transactions]);

  const toggleTransfer = useCallback((id: string) => {
    setPairedTransfers(prev =>
      prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t)
    );
  }, []);

  const toggleAllTransfers = useCallback(() => {
    const allSelected = pairedTransfers.every(t => t.selected);
    setPairedTransfers(prev =>
      prev.map(t => ({ ...t, selected: !allSelected }))
    );
  }, [pairedTransfers]);

  // Handle edit from modal
  const handleEditTransaction = useCallback((transaction: ParsedTransaction) => {
    setEditingTransaction(transaction);
  }, []);

  const handleSaveTransaction = useCallback((updated: ParsedTransaction) => {
    setTransactions(prev => 
      prev.map(t => t.id === updated.id ? updated : t)
    );
    setEditingTransaction(null);
  }, []);

  // Helper to find conta ID by name
  const findContaId = useCallback((contaName: string): string | null => {
    if (!contaName || !contas) return null;
    const lowerName = contaName.toLowerCase();
    const found = contas.find(c => 
      c.nome.toLowerCase().includes(lowerName) || 
      (c.banco && c.banco.toLowerCase().includes(lowerName))
    );
    return found?.id || null;
  }, [contas]);

  const handleImport = async () => {
    const selectedTransactions = transactions.filter(t => t.selected && !t.ignorar && !t.is_transfer);
    const selectedTransfers = pairedTransfers.filter(t => t.selected);
    
    if (selectedTransactions.length === 0 && selectedTransfers.length === 0) {
      toast({
        title: 'Nenhum item selecionado',
        description: 'Selecione pelo menos uma transação ou transferência para importar.',
        variant: 'destructive',
      });
      return;
    }

    setStep('importing');
    setImportProgress(0);

    const receitas = selectedTransactions.filter(t => t.tipo === 'receita');
    const despesas = selectedTransactions.filter(t => t.tipo === 'despesa');
    
    let imported = { receitas: 0, despesas: 0, transferencias: 0 };
    const total = selectedTransactions.length + selectedTransfers.length;
    let processed = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Import receitas
      for (const receita of receitas) {
        const contaId = receita.conta_id || findContaId(receita.conta_pagamento);
        const status = receita.status || 'pendente';
        const dataVenc = receita.data_vencimento || receita.data;
        const dataComp = receita.data_competencia || receita.data;
        const { error } = await supabase.from('receitas').insert({
          user_id: user.id,
          descricao: receita.descricao,
          valor: receita.valor,
          data_competencia: dataComp,
          data_vencimento: dataVenc,
          status: status as 'pendente' | 'recebido' | 'atrasado',
          conta_pagamento: receita.conta_pagamento || null,
          conta_id: contaId,
          categoria_id: receita.categoria_id || null,
          cliente_id: receita.cliente_id || null,
          forma_pagamento: receita.forma_pagamento || null,
          data_recebimento: receita.data_recebimento || null,
        });
        
        if (!error) imported.receitas++;
        processed++;
        setImportProgress(Math.round((processed / total) * 100));
      }

      // Import despesas
      for (const despesa of despesas) {
        const contaId = despesa.conta_id || findContaId(despesa.conta_pagamento);
        const status = despesa.status || 'pendente';
        const dataVenc = despesa.data_vencimento || despesa.data;
        const dataComp = despesa.data_competencia || despesa.data;
        const { error } = await supabase.from('despesas').insert({
          user_id: user.id,
          descricao: despesa.descricao,
          valor: despesa.valor,
          data_competencia: dataComp,
          data_vencimento: dataVenc,
          status: status as 'pendente' | 'pago' | 'atrasado',
          tipo: (despesa.tipo_despesa || 'variavel') as 'fixa' | 'variavel',
          conta_pagamento: despesa.conta_pagamento || null,
          conta_id: contaId,
          categoria_id: despesa.categoria_id || null,
          fornecedor: despesa.fornecedor || null,
          data_pagamento: despesa.data_pagamento || null,
          forma_pagamento: despesa.forma_pagamento || null,
          cliente_id: despesa.cliente_id || null,
        });
        
        if (!error) imported.despesas++;
        processed++;
        setImportProgress(Math.round((processed / total) * 100));
      }

      // Import transfers
      for (const transfer of selectedTransfers) {
        const contaOrigemId = findContaId(transfer.enviada.conta_pagamento);
        const contaDestinoId = findContaId(transfer.recebida.conta_pagamento);
        
        if (contaOrigemId && contaDestinoId && contaOrigemId !== contaDestinoId) {
          const { error } = await supabase.from('transferencias').insert({
            user_id: user.id,
            conta_origem_id: contaOrigemId,
            conta_destino_id: contaDestinoId,
            valor: transfer.enviada.valor,
            data_transferencia: transfer.enviada.data,
            descricao: `Transferência importada: ${transfer.enviada.descricao}`,
          });
          
          if (!error) imported.transferencias++;
        } else {
          console.warn('Could not identify accounts for transfer:', transfer);
        }
        processed++;
        setImportProgress(Math.round((processed / total) * 100));
      }

      setImportResult(imported);
      setStep('complete');
      
      const messages = [];
      if (imported.receitas > 0) messages.push(`${imported.receitas} receitas`);
      if (imported.despesas > 0) messages.push(`${imported.despesas} despesas`);
      if (imported.transferencias > 0) messages.push(`${imported.transferencias} transferências`);
      
      toast({
        title: 'Importação concluída!',
        description: messages.join(', ') + ' importadas.',
      });
    } catch (err) {
      console.error('Import error:', err);
      toast({
        title: 'Erro na importação',
        description: err instanceof Error ? err.message : 'Falha ao importar transações',
        variant: 'destructive',
      });
      setStep('preview');
    }
  };

  const handleFinish = () => {
    onImportComplete();
    handleClose();
  };

  const selectableCount = transactions.filter(t => !t.ignorar && !t.is_transfer);
  const selectedCount = transactions.filter(t => t.selected && !t.ignorar && !t.is_transfer);
  const duplicateCount = transactions.filter(t => t.isDuplicate && !t.is_transfer);
  const isAllSelected = selectableCount.length > 0 && selectableCount.length === selectedCount.length;
  const isAllTransfersSelected = pairedTransfers.length > 0 && pairedTransfers.every(t => t.selected);
  const totalSelected = selectedCount.length + pairedTransfers.filter(t => t.selected).length;
  const processingProgress = fileStatuses.length > 0 
    ? Math.round((fileStatuses.filter(s => s.status === 'done').length / fileStatuses.length) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Transações</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de um arquivo CSV, XLSX, PDF ou múltiplas imagens com suas transações.'}
            {step === 'processing' && (multipleFiles.length > 1 
              ? `Processando ${multipleFiles.length} imagens...` 
              : 'Processando arquivo...'
            )}
            {step === 'preview' && 'Revise e edite as transações detectadas antes de importar.'}
            {step === 'importing' && 'Importando transações...'}
            {step === 'complete' && 'Importação concluída com sucesso!'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {/* Upload Step */}
          {step === 'upload' && (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer",
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                error && "border-destructive"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="rounded-full bg-muted p-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Arraste arquivos aqui ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    CSV, XLSX, PDF (único) ou até {MAX_IMAGES} imagens de uma vez
                  </p>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <FileSpreadsheet className="h-6 w-6" />
                  <FileImage className="h-6 w-6" />
                  <Image className="h-6 w-6" />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileSelect}
                className="hidden"
                multiple
              />
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              {multipleFiles.length > 1 ? (
                <>
                  <p className="text-muted-foreground mb-2">
                    Processando {fileStatuses.filter(s => s.status === 'done').length + 1} de {fileStatuses.length} imagens...
                  </p>
                  <Progress value={processingProgress} className="w-64" />
                  
                  <div className="w-full max-w-md mt-4 space-y-2">
                    {fileStatuses.map((fileStatus, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg text-sm",
                          fileStatus.status === 'done' && "bg-emerald-50 dark:bg-emerald-950/20",
                          fileStatus.status === 'processing' && "bg-blue-50 dark:bg-blue-950/20",
                          fileStatus.status === 'error' && "bg-red-50 dark:bg-red-950/20",
                          fileStatus.status === 'pending' && "bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {fileStatus.status === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          {fileStatus.status === 'processing' && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                          {fileStatus.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                          {fileStatus.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                          <span className="truncate max-w-[200px]">{fileStatus.name}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {fileStatus.status === 'done' && `${fileStatus.transactionCount} transações`}
                          {fileStatus.status === 'processing' && 'processando...'}
                          {fileStatus.status === 'pending' && 'aguardando'}
                          {fileStatus.status === 'error' && 'erro'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Analisando {file?.name}...</p>
                </>
              )}
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary with duplicate warning */}
              {duplicateCount.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {duplicateCount.length} possíve{duplicateCount.length === 1 ? 'l' : 'is'} duplicado{duplicateCount.length === 1 ? '' : 's'} detectado{duplicateCount.length === 1 ? '' : 's'} (desmarcados por padrão)
                  </span>
                </div>
              )}
              <TransactionPreviewTable
                transactions={transactions}
                pairedTransfers={pairedTransfers}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onToggleTransfer={toggleTransfer}
                onToggleAllTransfers={toggleAllTransfers}
                isAllSelected={isAllSelected}
                isAllTransfersSelected={isAllTransfersSelected}
                onEdit={handleEditTransaction}
              />
              
              {/* Edit Modal */}
              <TransactionEditModal
                transaction={editingTransaction}
                open={!!editingTransaction}
                onClose={() => setEditingTransaction(null)}
                onSave={handleSaveTransaction}
                categorias={categorias}
                contas={contas || []}
                clientes={(clientes || []).map(c => ({ id: c.id, nome: c.nome }))}
              />
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <Progress value={importProgress} className="w-64" />
              <p className="text-muted-foreground">Importando transações... {importProgress}%</p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && importResult && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">Importação concluída!</p>
                <p className="text-muted-foreground mt-2">
                  {importResult.receitas > 0 && (
                    <><span className="text-emerald-600 font-medium">{importResult.receitas}</span> receitas</>
                  )}
                  {importResult.receitas > 0 && importResult.despesas > 0 && ', '}
                  {importResult.despesas > 0 && (
                    <><span className="text-red-600 font-medium">{importResult.despesas}</span> despesas</>
                  )}
                  {(importResult.receitas > 0 || importResult.despesas > 0) && importResult.transferencias > 0 && ' e '}
                  {importResult.transferencias > 0 && (
                    <><span className="text-blue-600 font-medium">{importResult.transferencias}</span> transferências</>
                  )}
                  {' '}importadas.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetState}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={totalSelected === 0}
              >
                Importar ({totalSelected})
              </Button>
            </>
          )}
          
          {step === 'complete' && (
            <Button onClick={handleFinish}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
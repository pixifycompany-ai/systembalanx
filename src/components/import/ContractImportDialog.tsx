import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, UserPlus, User, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { gerarParcelas, type ParcelaFormData } from '@/hooks/useContratoParcelas';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { findPossibleDuplicate, type DuplicateMatch } from '@/utils/contractDuplicates';

interface ContractImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ParsedContract {
  objeto_contrato: string;
  valor_mensal: number;
  valor_total: number | null;
  tipo_recorrencia: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'unico';
  data_inicio: string;
  data_fim: string | null;
  contratante_nome: string;
  contratante_cnpj: string;
  contratante_email: string;
  contratante_telefone: string;
}

interface ExistingClient {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
}

type ImportStep = 'upload' | 'processing' | 'review' | 'saving' | 'complete';

const RECORRENCIA_OPTIONS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'unico', label: 'Único' },
] as const;

export function ContractImportDialog({ open, onOpenChange, onImportComplete }: ContractImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<ImportStep>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [contract, setContract] = useState<ParsedContract | null>(null);
  const [existingClient, setExistingClient] = useState<ExistingClient | null>(null);
  const [willCreateClient, setWillCreateClient] = useState(false);
  
  // Editable form data
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    recorrencia: 'mensal' as ParsedContract['tipo_recorrencia'],
    data_inicio: '',
    data_fim: '',
    dia_vencimento: '10',
    num_parcelas: '1',
    cliente_nome: '',
    cliente_cnpj: '',
    cliente_email: '',
    cliente_telefone: '',
  });

  // Parcelas state for unique contracts
  const [parcelas, setParcelas] = useState<ParcelaFormData[]>([]);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);

  // Generate parcelas when num_parcelas or valor changes for unique contracts
  useEffect(() => {
    if (formData.recorrencia === 'unico' && formData.valor && formData.data_inicio) {
      const numParcelas = parseInt(formData.num_parcelas) || 1;
      const valorTotal = parseFloat(formData.valor) || 0;
      const primeiroVencimento = new Date(formData.data_inicio);
      
      if (numParcelas > 0 && valorTotal > 0 && !isNaN(primeiroVencimento.getTime())) {
        const novasParcelas = gerarParcelas(valorTotal, numParcelas, primeiroVencimento);
        setParcelas(novasParcelas);
      }
    }
  }, [formData.recorrencia, formData.num_parcelas, formData.valor, formData.data_inicio]);

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setContract(null);
    setExistingClient(null);
    setWillCreateClient(false);
    setError(null);
    setParcelas([]);
    setFormData({
      descricao: '',
      valor: '',
      recorrencia: 'mensal',
      data_inicio: '',
      data_fim: '',
      dia_vencimento: '10',
      num_parcelas: '1',
      cliente_nome: '',
      cliente_cnpj: '',
      cliente_email: '',
      cliente_telefone: '',
    });
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const checkExistingClient = async (cnpj: string): Promise<ExistingClient | null> => {
    if (!cnpj || cnpj.length < 11) return null;
    
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, cpf_cnpj')
      .eq('cpf_cnpj', cleanCnpj)
      .single();
    
    return data || null;
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setStep('processing');
    setError(null);

    try {
      // Read file as base64
      const arrayBuffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileContent = btoa(binary);

      const { data, error: fnError } = await supabase.functions.invoke('parse-contract', {
        body: {
          file_content: fileContent,
          file_type: selectedFile.type || 'application/pdf',
        },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || fnError?.message || 'Failed to parse contract');
      }

      const parsedContract: ParsedContract = data.contract;
      setContract(parsedContract);
      
      // Check if client exists
      const existing = await checkExistingClient(parsedContract.contratante_cnpj);
      setExistingClient(existing);
      setWillCreateClient(!existing && !!parsedContract.contratante_cnpj);
      
      // Populate form
      setFormData({
        descricao: parsedContract.objeto_contrato,
        valor: String(parsedContract.valor_mensal || 0),
        recorrencia: parsedContract.tipo_recorrencia,
        data_inicio: parsedContract.data_inicio,
        data_fim: parsedContract.data_fim || '',
        dia_vencimento: '10',
        num_parcelas: '1',
        cliente_nome: parsedContract.contratante_nome,
        cliente_cnpj: parsedContract.contratante_cnpj,
        cliente_email: parsedContract.contratante_email,
        cliente_telefone: parsedContract.contratante_telefone,
      });
      
      setStep('review');
    } catch (err) {
      console.error('Error processing contract:', err);
      setError(err instanceof Error ? err.message : 'Failed to process contract');
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
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, []);

  const resolveClienteId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    if (existingClient) return existingClient.id;
    if (willCreateClient && formData.cliente_nome) {
      const { data: newClient, error: clientError } = await supabase
        .from('clientes')
        .insert({
          user_id: user.id,
          nome: formData.cliente_nome,
          cpf_cnpj: formData.cliente_cnpj.replace(/\D/g, '') || null,
          email: formData.cliente_email || null,
          telefone: formData.cliente_telefone || null,
          tipo: formData.cliente_cnpj.replace(/\D/g, '').length === 14 ? 'PJ' : 'PF',
          status: 'ativo',
        })
        .select('id')
        .single();
      if (clientError) throw clientError;
      return newClient.id;
    }
    return null;
  };

  const checkDuplicateForClient = async (clienteId: string): Promise<DuplicateMatch | null> => {
    const { data } = await supabase
      .from('contratos')
      .select('*, cliente:clientes(*)')
      .eq('cliente_id', clienteId)
      .eq('status', 'ativo');
    if (!data) return null;
    return findPossibleDuplicate(
      {
        cliente_id: clienteId,
        descricao: formData.descricao,
        recorrencia: formData.recorrencia,
        valor: parseFloat(formData.valor),
      },
      data as any
    );
  };

  const insertContrato = async (clienteId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: newContrato, error: contractError } = await supabase
      .from('contratos')
      .insert({
        user_id: user.id,
        cliente_id: clienteId,
        descricao: formData.descricao,
        valor: parseFloat(formData.valor),
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim || null,
        dia_vencimento: formData.recorrencia !== 'unico'
          ? parseInt(formData.dia_vencimento) || null
          : null,
        recorrencia: formData.recorrencia,
        status: 'ativo',
      })
      .select('id')
      .single();

    if (contractError) throw contractError;

    if (newContrato && formData.recorrencia === 'unico' && parcelas.length > 0) {
      const parcelasData = parcelas.map(p => ({
        contrato_id: newContrato.id,
        numero_parcela: p.numero_parcela,
        valor: p.valor,
        data_vencimento: p.data_vencimento,
        status: 'pendente' as const,
      }));
      const { error: parcelasError } = await supabase
        .from('contrato_parcelas')
        .insert(parcelasData);
      if (parcelasError) console.error('Error creating parcelas:', parcelasError);
    }
  };

  const handleSave = async () => {
    if (!formData.descricao || !formData.valor || !formData.data_inicio) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha descrição, valor e data de início.', variant: 'destructive' });
      return;
    }
    if (formData.recorrencia !== 'unico' && !formData.dia_vencimento) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha o dia de vencimento para contratos recorrentes.', variant: 'destructive' });
      return;
    }

    setStep('saving');
    try {
      const clienteId = await resolveClienteId();
      if (!clienteId) {
        toast({ title: 'Cliente não identificado', description: 'Não foi possível identificar ou criar o cliente.', variant: 'destructive' });
        setStep('review');
        return;
      }

      // Duplicate detection — offer aditivo path
      const match = await checkDuplicateForClient(clienteId);
      if (match) {
        setDuplicateMatch(match);
        setStep('review');
        return;
      }

      await insertContrato(clienteId);
      setStep('complete');
      toast({
        title: 'Contrato criado!',
        description: willCreateClient ? 'O cliente e o contrato foram cadastrados com sucesso.' : 'O contrato foi cadastrado com sucesso.',
      });
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: 'Erro ao salvar', description: err instanceof Error ? err.message : 'Falha ao salvar contrato', variant: 'destructive' });
      setStep('review');
    }
  };

  const handleDuplicateApplyAsAditivo = async () => {
    if (!duplicateMatch) return;
    setStep('saving');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const valorNovo = parseFloat(formData.valor);
      const { error: aditivoError } = await supabase
        .from('contrato_aditivos' as any)
        .insert({
          contrato_id: duplicateMatch.contrato.id,
          valor_anterior: Number(duplicateMatch.contrato.valor),
          valor_novo: valorNovo,
          data_vigencia: formData.data_inicio,
          motivo: 'Reajuste importado de PDF',
          user_id: user.id,
        } as any);
      if (aditivoError) throw aditivoError;

      const { error: updateError } = await supabase
        .from('contratos')
        .update({ valor: valorNovo })
        .eq('id', duplicateMatch.contrato.id);
      if (updateError) throw updateError;

      setDuplicateMatch(null);
      setStep('complete');
      toast({ title: 'Aditivo registrado!', description: 'O reajuste foi aplicado ao contrato existente.' });
    } catch (err) {
      console.error('Aditivo error:', err);
      toast({ title: 'Erro ao registrar aditivo', description: err instanceof Error ? err.message : 'Falha ao registrar aditivo', variant: 'destructive' });
      setStep('review');
    }
  };

  const handleDuplicateCreateAnyway = async () => {
    if (!duplicateMatch) return;
    setStep('saving');
    try {
      const clienteId = duplicateMatch.contrato.cliente_id;
      await insertContrato(clienteId);
      setDuplicateMatch(null);
      setStep('complete');
      toast({ title: 'Contrato criado!', description: 'O contrato foi cadastrado com sucesso.' });
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: 'Erro ao salvar', description: err instanceof Error ? err.message : 'Falha ao salvar contrato', variant: 'destructive' });
      setStep('review');
    }
  };


  const handleFinish = () => {
    onImportComplete();
    handleClose();
  };

  // Format CNPJ/CPF for display
  const formatDocument = (doc: string) => {
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return doc;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Contrato PDF</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de um PDF de contrato para análise automática com IA.'}
            {step === 'processing' && 'Analisando contrato com IA...'}
            {step === 'review' && 'Revise os dados extraídos e faça ajustes se necessário.'}
            {step === 'saving' && 'Salvando contrato...'}
            {step === 'complete' && 'Contrato importado com sucesso!'}
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
                  <p className="font-medium">Arraste um PDF aqui ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    A IA irá analisar e extrair os dados do contrato
                  </p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
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
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Analisando {file?.name}...</p>
              <p className="text-sm text-muted-foreground">A IA está interpretando as cláusulas do contrato</p>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Client Status Alert */}
              {existingClient ? (
                <Alert className="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
                  <User className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                    Cliente encontrado: <strong>{existingClient.nome}</strong>
                  </AlertDescription>
                </Alert>
              ) : willCreateClient ? (
                <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                  <UserPlus className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    Novo cliente será criado: <strong>{formData.cliente_nome}</strong>
                  </AlertDescription>
                </Alert>
              ) : null}

              {/* Client Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Dados do Cliente
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={formData.cliente_nome}
                      onChange={(e) => setFormData(prev => ({ ...prev, cliente_nome: e.target.value }))}
                      disabled={!!existingClient}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ/CPF</Label>
                    <Input
                      value={formatDocument(formData.cliente_cnpj)}
                      onChange={(e) => setFormData(prev => ({ ...prev, cliente_cnpj: e.target.value }))}
                      disabled={!!existingClient}
                    />
                  </div>
                </div>
              </div>

              {/* Contract Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Dados do Contrato
                </h4>
                
                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.valor}
                      onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Recorrência</Label>
                    <Select
                      value={formData.recorrencia}
                      onValueChange={(value: ParsedContract['tipo_recorrencia']) => 
                        setFormData(prev => ({ ...prev, recorrencia: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECORRENCIA_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Conditional: Dia de Vencimento for recurring contracts */}
                {formData.recorrencia !== 'unico' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Dia de Vencimento *
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.dia_vencimento}
                      onChange={(e) => setFormData(prev => ({ ...prev, dia_vencimento: e.target.value }))}
                      placeholder="Ex: 10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Dia do mês para cobrança (1-31)
                    </p>
                  </div>
                )}

                {/* Conditional: Parcelas for unique contracts */}
                {formData.recorrencia === 'unico' && (
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Número de Parcelas
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="60"
                        value={formData.num_parcelas}
                        onChange={(e) => setFormData(prev => ({ ...prev, num_parcelas: e.target.value }))}
                      />
                    </div>

                    {parcelas.length > 0 && (
                      <div className="space-y-2">
                        <Label>Parcelas</Label>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="px-3 py-2 text-left">#</th>
                                <th className="px-3 py-2 text-left">Vencimento</th>
                                <th className="px-3 py-2 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parcelas.map((parcela, index) => (
                                <tr key={index} className="border-t">
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {parcela.numero_parcela}/{parcelas.length}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="date"
                                      value={parcela.data_vencimento}
                                      onChange={(e) => {
                                        const newParcelas = [...parcelas];
                                        newParcelas[index] = { ...newParcelas[index], data_vencimento: e.target.value };
                                        setParcelas(newParcelas);
                                      }}
                                      className="h-8 w-full"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={parcela.valor}
                                      onChange={(e) => {
                                        const newParcelas = [...parcelas];
                                        newParcelas[index] = { ...newParcelas[index], valor: parseFloat(e.target.value) || 0 };
                                        setParcelas(newParcelas);
                                      }}
                                      className="h-8 w-24 text-right"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-muted">
                              <tr className="border-t font-medium">
                                <td colSpan={2} className="px-3 py-2">Total</td>
                                <td className="px-3 py-2 text-right">
                                  {formatCurrency(parcelas.reduce((sum, p) => sum + p.valor, 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <DatePickerField
                    label="Data Início *"
                    value={formData.data_inicio}
                    onChange={(d) => setFormData(prev => ({ ...prev, data_inicio: d }))}
                    required
                  />
                  <DatePickerField
                    label="Data Fim"
                    value={formData.data_fim}
                    onChange={(d) => setFormData(prev => ({ ...prev, data_fim: d }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Saving Step */}
          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Salvando contrato...</p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">Contrato importado!</p>
                <p className="text-muted-foreground mt-2">
                  {willCreateClient 
                    ? 'O cliente e o contrato foram cadastrados com sucesso.' 
                    : 'O contrato foi vinculado ao cliente existente.'}
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
          
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={resetState}>
                Voltar
              </Button>
              <Button onClick={handleSave}>
                {willCreateClient ? 'Criar Cliente e Contrato' : 'Criar Contrato'}
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
    <Dialog open={!!duplicateMatch} onOpenChange={(o) => { if (!o) setDuplicateMatch(null); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Contrato similar já existe</DialogTitle>
          <DialogDescription>
            Detectamos um contrato ativo parecido para este cliente. Recomendamos registrar este novo valor como um aditivo (reajuste) em vez de criar duplicata.
          </DialogDescription>
        </DialogHeader>
        {duplicateMatch && (
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-sm">
              <div className="font-medium">{duplicateMatch.contrato.descricao}</div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Valor atual:</span>
                <span className="tabular-nums">{formatCurrency(Number(duplicateMatch.contrato.valor))}</span>
                {!duplicateMatch.sameValue && (
                  <>
                    <span>→</span>
                    <span className="font-semibold tabular-nums text-primary">
                      {formatCurrency(parseFloat(formData.valor))}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {!duplicateMatch.sameValue && (
                <Button onClick={handleDuplicateApplyAsAditivo} className="w-full">
                  Registrar como Aditivo (recomendado)
                </Button>
              )}
              <Button variant="outline" onClick={handleDuplicateCreateAnyway} className="w-full">
                Criar novo contrato mesmo assim
              </Button>
              <Button variant="ghost" onClick={() => setDuplicateMatch(null)} className="w-full">
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}


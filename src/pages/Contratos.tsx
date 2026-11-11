import { useState, useMemo, useEffect } from 'react';
import { useActionParam } from '@/hooks/useActionParam';
import { IconButton } from '@/components/shared/IconButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MobileContratosList } from '@/components/contratos/MobileContratosList';
import { KpiTriple } from '@/components/shared/KpiTriple';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner, SkeletonTable } from '@/components/shared/LoadingSpinner';
import { MultiSelectBar } from '@/components/shared/MultiSelectBar';
import { SectionCard } from '@/components/shared/SectionCard';
import { ScrollPills, Pill } from '@/components/shared/ScrollPills';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChoiceChip, FormSection, InitialsAvatar, InlineNotice, NATIVE_SELECT_CLS, SheetFooter, SheetHeading } from '@/components/cobrancas/formParts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { exportContratos } from '@/utils/exportCSV';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useContratos, type ContratoFormData } from '@/hooks/useContratos';
import { useCobrancas, preencherTemplate, notasDasLinhas, WHATSAPP_TEMPLATE_PIX_PADRAO, type Cobranca } from '@/hooks/useCobrancas';
import { useContas } from '@/hooks/useContas';
import { ContratoCobrancaCell } from '@/components/contratos/ContratoCobrancaCell';
import { AgruparCobrancaSheet, type ContratoParaAgrupar } from '@/components/contratos/AgruparCobrancaSheet';
import { EditarClienteSheet } from '@/components/clientes/EditarClienteSheet';
import { useContratoParcelas, gerarParcelas, type ParcelaFormData } from '@/hooks/useContratoParcelas';
import { useClientes } from '@/hooks/useClientes';
import { Plus, Pencil, Trash2, FileText, RefreshCw, Upload, Calendar, TrendingUp, X, Zap, ChevronUp, ChevronDown, ChevronsUpDown, Loader2, Layers } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ContractImportDialog } from '@/components/import/ContractImportDialog';
import { useContratoAditivos, type AditivoFormData } from '@/hooks/useContratoAditivos';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { PausaContrato } from '@/components/contratos/PausaContrato';
import { estadoPausa } from '@/lib/pausaContrato';
import { findPossibleDuplicate, findDuplicateGroups, type DuplicateMatch, type DuplicateGroup } from '@/utils/contractDuplicates';
import { isContratoAtivoHoje, getValorMensalEquivalente } from '@/utils/contractUtils';
import { AlertTriangle, Search } from 'lucide-react';

const RECORRENCIA_OPTIONS = [
  { value: 'semanal', label: 'Semanal (7 dias)' },
  { value: 'quinzenal', label: 'Quinzenal (15 dias)' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'unico', label: 'Único' },
] as const;

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'encerrado', label: 'Encerrado' },
] as const;

export default function Contratos() {
  const isMobile = useIsMobile();
  const { 
    contratos, 
    isLoading, 
    createContrato, 
    updateContrato, 
    deleteContrato, 
    deleteMultipleContratos,
    inactivateContrato,
    refetch: refetchContratos,
  } = useContratos();
  
  const { createParcelas, deleteParcelas } = useContratoParcelas();
  const { clientes, createCliente, updateCliente } = useClientes();
  const [editarClienteOpen, setEditarClienteOpen] = useState(false);
  const { contas } = useContas();
  const contasRecebimento = useMemo(
    () => contas.filter((c) => c.ativa && c.tipo !== 'cartao_credito').map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })),
    [contas],
  );
  // Criar a cobrança no Asaas junto com o contrato (opcional)
  const [novoContratoCobranca, setNovoContratoCobranca] = useState(false);
  const [ncForma, setNcForma] = useState('UNDEFINED');
  const [ncConta, setNcConta] = useState('');
  const [ncMulta, setNcMulta] = useState('');
  const [ncJuros, setNcJuros] = useState('');
  // Exceção de envio automático + exigência de NF (por contrato)
  const [caModo, setCaModo] = useState<'padrao' | 'off' | 'custom'>('padrao');
  const [caAntes, setCaAntes] = useState('');
  const [caNoDia, setCaNoDia] = useState(true);
  const [caAtraso, setCaAtraso] = useState(false);
  const [caExigirNf, setCaExigirNf] = useState(false);
  const [caEnvioPix, setCaEnvioPix] = useState(false);
  // Cobrança recorrente via Asaas (por contrato)
  const {
    cobrancas,
    byContrato,
    bySubscription,
    agrupar: agruparContratos,
    busyId: cobrBusyId,
    loading: cobrLoading,
    criarDoContrato: criarCobranca,
    listarAssinaturas,
    vincularAssinatura,
    desvincularAssinatura,
    encerrarContratoCobrancas,
    reajustarAssinatura,
    cancelar: cancelarCobranca,
    excluir: excluirCobranca,
    sincronizar: sincronizarCobrancas,
    receberManual: receberManualCobranca,
    enviarWhatsapp,
    notaSignedUrl,
    marcarNotasEnviadas,
    whatsappTemplate,
    pixCfg,
  } = useCobrancas();

  // WhatsApp da cobrança (mensagem editável antes de enviar)
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappTel, setWhatsappTel] = useState('');
  const [whatsappText, setWhatsappText] = useState('');
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappCob, setWhatsappCob] = useState<Cobranca | null>(null);
  const [whatsappGrupo, setWhatsappGrupo] = useState<Cobranca[]>([]);
  // Cobrança de um contrato: direta, ou a do grupo (via assinatura) quando a
  // fatura ficou como linha única sem contrato_id.
  const cobrancaDoContrato = (contratoId: string): Cobranca | undefined => {
    const direta = byContrato.get(contratoId);
    if (direta) return direta;
    const sub = contratos.find((c) => c.id === contratoId)?.asaas_subscription_id;
    return sub ? bySubscription.get(sub) : undefined;
  };
  // Linhas da mesma fatura: contratos agrupados numa assinatura dividem um boleto.
  const linhasDaFatura = (cob: Cobranca): Cobranca[] => {
    if (!cob.asaas_payment_id) return [cob];
    const linhas = cobrancas.filter((c) => c.asaas_payment_id === cob.asaas_payment_id && c.status !== 'cancelado');
    return linhas.length ? linhas : [cob];
  };
  const openWhatsapp = (cob?: Cobranca) => {
    if (!cob) return;
    const cli = clientes.find((c) => c.id === cob.cliente_id);
    const grupo = linhasDaFatura(cob);
    setWhatsappGrupo(grupo);
    setWhatsappCob(cob);
    setWhatsappTel(cli?.telefone || '');
    const usaPix = grupo.some((l) => l.envio_pix) && !!pixCfg.chave;
    setWhatsappText(preencherTemplate(usaPix ? (pixCfg.template || WHATSAPP_TEMPLATE_PIX_PADRAO) : whatsappTemplate, {
      cliente: cli?.nome || 'cliente',
      descricao: grupo.map((l) => l.descricao).filter(Boolean).join(' + ') || 'cobrança',
      valor: formatCurrency(grupo.reduce((s, l) => s + (Number(l.valor) || 0), 0)),
      vencimento: formatDate(cob.vencimento),
      link: cob.invoice_url || '',
      pix: pixCfg.chave,
      titular: pixCfg.titular,
    }));
    setWhatsappOpen(true);
  };
  const whatsappNotas = useMemo(() => notasDasLinhas(whatsappGrupo), [whatsappGrupo]);
  const whatsappBloqueado = whatsappGrupo.some((l) => l.exigir_nf)
    && !whatsappNotas.length && !whatsappGrupo.some((l) => l.nota_fiscal_enviada);
  const handleEnviarWhatsapp = async () => {
    if (!whatsappCob) return;
    if (whatsappBloqueado) { toast.error('Esta cobrança exige nota fiscal anexada para disparar.'); return; }
    setWhatsappSending(true);
    const docs: { url: string; nome: string }[] = [];
    for (const n of whatsappNotas) {
      const url = await notaSignedUrl(n.path);
      if (!url) break;
      docs.push({ url, nome: n.nome });
    }
    const res = await enviarWhatsapp(whatsappTel, whatsappText, docs);
    setWhatsappSending(false);
    if (res) {
      await marcarNotasEnviadas(whatsappNotas.slice(0, res.docsEnviados));
      setWhatsappOpen(false);
    }
  };
  // Criar cliente inline dentro do formulário de contrato
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [criandoCliente, setCriandoCliente] = useState(false);
  const handleCriarClienteInline = async () => {
    const nome = novoClienteNome.trim();
    if (!nome) return;
    setCriandoCliente(true);
    const novo = await createCliente({
      nome, email: '', telefone: '', cpf_cnpj: '', tipo: 'PJ',
      endereco: '', status: 'ativo', empresa_fonte: 'PIXIFY',
    } as never);
    setCriandoCliente(false);
    if (novo) {
      setFormData(prev => ({ ...prev, cliente_id: novo.id }));
      setNovoClienteNome('');
      setNovoClienteOpen(false);
    }
  };
  
  // Aditivos state
  const [editingContratoId, setEditingContratoId] = useState<string | undefined>(undefined);
  const { aditivos, isLoading: aditivosLoading, createAditivo, deleteAditivo } = useContratoAditivos(editingContratoId);
  const [showAditivoForm, setShowAditivoForm] = useState(false);
  const [aditivoData, setAditivoData] = useState<{ valor_novo: string; data_vigencia: string; motivo: string }>({
    valor_novo: '',
    data_vigencia: '',
    motivo: '',
  });
  
  const [statusFilter, setStatusFilter] = useState<string>('ativo');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  useActionParam('novo', () => handleNew());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<{ id: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [desvincularAlvo, setDesvincularAlvo] = useState<{ id: string; nome: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);
  const [pendingSubmitData, setPendingSubmitData] = useState<ContratoFormData | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    cliente_id: string;
    descricao: string;
    valor: string;
    data_inicio: string;
    data_fim: string;
    dia_vencimento: string;
    recorrencia: 'semanal' | 'quinzenal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'unico';
    status: 'ativo' | 'cancelado' | 'encerrado';
    num_parcelas: string;
    data_inativacao: string;
  }>({
    cliente_id: '',
    descricao: '',
    valor: '',
    data_inicio: '',
    data_fim: '',
    dia_vencimento: '',
    recorrencia: 'mensal',
    status: 'ativo',
    num_parcelas: '1',
    data_inativacao: '',
  });

  // Parcelas state for unique contracts
  const [parcelas, setParcelas] = useState<ParcelaFormData[]>([]);

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

  // Filter contratos
  const filteredContratos = useMemo(() => {
    return contratos.filter(c => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesSearch = !searchTerm || 
        c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [contratos, statusFilter, searchTerm]);

  // Ordenação por coluna (clicando no cabeçalho)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const toggleSort = (key: string) => setSort((p) => (p?.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const sortedContratos = useMemo(() => {
    if (!sort) return filteredContratos;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (c: any): string | number => {
      switch (sort.key) {
        case 'cliente': return (c.cliente?.nome || '').toLowerCase();
        case 'descricao': return (c.descricao || '').toLowerCase();
        case 'recorrencia': return c.recorrencia || '';
        case 'valor': return Number(c.valor) || 0;
        case 'inicio': return c.data_inicio || '';
        case 'status': return c.status || '';
        default: return '';
      }
    };
    return [...filteredContratos].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'pt-BR') * dir;
    });
  }, [filteredContratos, sort]);
  const sortIcon = (key: string) => sort?.key === key
    ? (sort.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
    : <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />;

  // Calculate totals using actual vigência (status + dates) so MRR matches reality
  const totals = useMemo(() => {
    const vigentes = filteredContratos.filter(c => isContratoAtivoHoje(c as any));
    // MRR = soma do valor MENSAL EQUIVALENTE (quinzenal conta 2×, trimestral ÷3, etc.).
    const mrrTotal = vigentes
      .reduce((sum, c) => sum + getValorMensalEquivalente(Number(c.valor), c.recorrencia), 0);
    const ativos = vigentes.length;
    const valorTotal = vigentes.reduce((sum, c) => sum + Number(c.valor), 0);
    return { mrrTotal, ativos, valorTotal };
  }, [filteredContratos]);

  // Detect already-existing duplicate active contracts so user can sanitize
  const duplicateGroups = useMemo(() => findDuplicateGroups(contratos), [contratos]);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [keepContratoId, setKeepContratoId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const openMergeDialog = (group: DuplicateGroup) => {
    setMergeGroup(group);
    // Sugere manter o mais recente (já vem ordenado).
    setKeepContratoId(group.contratos[0]?.id || null);
  };

  const handleMergeDuplicates = async () => {
    if (!mergeGroup || !keepContratoId) return;
    const keeper = mergeGroup.contratos.find(c => c.id === keepContratoId);
    if (!keeper) return;
    setIsMerging(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const losers = mergeGroup.contratos.filter(c => c.id !== keeper.id);
      for (const loser of losers) {
        const valorLoser = Number(loser.valor);
        const valorKeeper = Number(keeper.valor);
        // Se valores são diferentes, registra como histórico no contrato mantido.
        if (Math.abs(valorLoser - valorKeeper) > 0.01) {
          await createAditivo(keeper.id, valorKeeper, {
            valor_novo: valorKeeper, // mantém valor atual do keeper como vigente
            data_vigencia: today,
            motivo: `Mesclagem: contrato duplicado "${loser.descricao}" (R$ ${valorLoser.toFixed(2)}) inativado`,
          });
        }
        await inactivateContrato(loser.id, today, 'encerrado');
      }
      await refetchContratos();
      setMergeGroup(null);
      setKeepContratoId(null);
    } finally {
      setIsMerging(false);
    }
  };

  // Multi-select
  const {
    selectedIds,
    selectedItems,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useMultiSelect({
    items: filteredContratos,
    getItemId: (item) => item.id,
  });

  // Cobrar vários contratos juntos (uma assinatura / um boleto)
  const [agruparOpen, setAgruparOpen] = useState(false);
  const contratosParaAgrupar = useMemo<ContratoParaAgrupar[]>(
    () => selectedItems.map((c) => ({
      id: c.id,
      cliente_id: c.cliente_id,
      descricao: c.descricao,
      valor: Number(c.valor),
      recorrencia: c.recorrencia,
      dia_vencimento: c.dia_vencimento ?? null,
      status: c.status,
      cobrado: !!(c as { asaas_subscription_id?: string | null }).asaas_subscription_id || byContrato.has(c.id),
    })),
    [selectedItems, byContrato],
  );

  // Bulk delete
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = async () => {
    setIsSaving(true);
    const success = await deleteMultipleContratos(Array.from(selectedIds));
    if (success) {
      setBulkDeleteDialogOpen(false);
      clearSelection();
    }
    setIsSaving(false);
  };

  const handleExport = () => {
    const dataToExport = selectedItems.map(c => ({
      numero_contrato: c.id.slice(0, 8),
      cliente: c.cliente?.nome || '-',
      tipo: c.recorrencia,
      valor_mensal: Number(c.valor),
      data_inicio: c.data_inicio,
      status: c.status,
    }));
    exportContratos(dataToExport);
  };

  // Open modal for new contrato
  const handleNew = () => {
    setEditingContrato(null);
    setEditingContratoId(undefined);
    setFormData({
      cliente_id: '',
      descricao: '',
      valor: '',
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: '',
      dia_vencimento: '10',
      recorrencia: 'mensal',
      status: 'ativo',
      num_parcelas: '1',
      data_inativacao: '',
    });
    setParcelas([]);
    setShowAditivoForm(false);
    setCaModo('padrao'); setCaAntes(''); setCaNoDia(true); setCaAtraso(false); setCaExigirNf(false); setCaEnvioPix(false);
    setModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (contrato: typeof contratos[0]) => {
    setEditingContrato({ id: contrato.id });
    setEditingContratoId(contrato.id);
    setFormData({
      cliente_id: contrato.cliente_id,
      descricao: contrato.descricao,
      valor: String(contrato.valor),
      data_inicio: contrato.data_inicio,
      data_fim: contrato.data_fim || '',
      dia_vencimento: contrato.dia_vencimento ? String(contrato.dia_vencimento) : '',
      recorrencia: contrato.recorrencia,
      status: contrato.status,
      num_parcelas: '1',
      data_inativacao: contrato.data_inativacao || '',
    });
    setParcelas([]);
    setShowAditivoForm(false);
    setAditivoData({ valor_novo: '', data_vigencia: '', motivo: '' });
    const c = contrato as unknown as { cobranca_auto_modo?: string; cobranca_auto_antes_dias?: number | null; cobranca_auto_no_dia?: boolean | null; cobranca_auto_atraso_diario?: boolean | null; exigir_nf?: boolean | null; envio_pix?: boolean | null };
    setCaModo((c.cobranca_auto_modo as 'padrao' | 'off' | 'custom') || 'padrao');
    setCaAntes(c.cobranca_auto_antes_dias != null ? String(c.cobranca_auto_antes_dias) : '');
    setCaNoDia(c.cobranca_auto_no_dia ?? true);
    setCaAtraso(!!c.cobranca_auto_atraso_diario);
    setCaExigirNf(!!c.exigir_nf);
    setCaEnvioPix(!!c.envio_pix);
    setModalOpen(true);
  };

  const handleSaveAditivo = async () => {
    if (!editingContratoId || !aditivoData.valor_novo || !aditivoData.data_vigencia) return;
    setIsSaving(true);
    const success = await createAditivo(
      editingContratoId,
      parseFloat(formData.valor),
      {
        valor_novo: parseFloat(aditivoData.valor_novo),
        data_vigencia: aditivoData.data_vigencia,
        motivo: aditivoData.motivo || undefined,
      }
    );
    if (success) {
      const novoValor = parseFloat(aditivoData.valor_novo);
      setFormData(prev => ({ ...prev, valor: aditivoData.valor_novo }));
      setShowAditivoForm(false);
      setAditivoData({ valor_novo: '', data_vigencia: '', motivo: '' });
      refetchContratos();
      // Se há cobrança Asaas vinculada, reajusta a assinatura + faturas pendentes lá também
      if (cobrancaDoContrato(editingContratoId)) {
        await reajustarAssinatura(editingContratoId, novoValor);
      }
    }
    setIsSaving(false);
  };

  // Persist contrato — extracted so we can call it after duplicate dialog
  const persistContrato = async (data: ContratoFormData) => {
    setIsSaving(true);
    let contratoResult;
    if (editingContrato) {
      contratoResult = await updateContrato(editingContrato.id, data);
    } else {
      contratoResult = await createContrato(data);
    }

    if (contratoResult && !editingContrato && formData.recorrencia === 'unico' && parcelas.length > 0) {
      await createParcelas(contratoResult.id, parcelas);
    }

    // Exceção de envio automático + exigência de NF (grava direto na linha do contrato)
    if (contratoResult) {
      await (supabase as any).from('contratos').update({
        cobranca_auto_modo: caModo,
        cobranca_auto_antes_dias: caModo === 'custom' ? (parseInt(caAntes) || 0) : null,
        cobranca_auto_no_dia: caModo === 'custom' ? caNoDia : null,
        cobranca_auto_atraso_diario: caModo === 'custom' ? caAtraso : null,
        exigir_nf: caExigirNf,
        envio_pix: caEnvioPix,
      }).eq('id', contratoResult.id);
    }

    // Já criar a cobrança recorrente no Asaas junto com o contrato (opcional)
    if (contratoResult && !editingContrato && novoContratoCobranca && formData.recorrencia !== 'unico') {
      await criarCobranca(contratoResult.id, ncForma, ncConta || null, {
        multa_percent: parseFloat(ncMulta) || 0,
        juros_percent: parseFloat(ncJuros) || 0,
      });
    }

    // Encerrar/cancelar: cancela as cobranças AGUARDANDO (pendentes) e preserva as
    // vencidas; para a assinatura no Asaas. (Só na edição, ao inativar o contrato.)
    if (contratoResult && editingContrato && data.status !== 'ativo') {
      const r = await encerrarContratoCobrancas(editingContrato.id);
      await refetchContratos();
      if ((r?.canceladas ?? 0) > 0) {
        toast.success(`${r!.canceladas} cobrança(s) aguardando cancelada(s).`, { description: 'As vencidas foram mantidas.' });
      }
      // Receitas futuras ainda em aberto (geradas pela janela de 12 meses ou lançadas
      // à mão) deixam de fazer sentido: pergunta antes de apagar. Recebidas ficam.
      const corte = data.data_inativacao || new Date().toISOString().split('T')[0];
      const { data: futuras } = await supabase.from('receitas').select('id, data_vencimento')
        .eq('contrato_id', editingContrato.id).in('status', ['pendente', 'atrasado'])
        .gt('data_vencimento', corte).order('data_vencimento');
      if (futuras?.length) {
        const de = formatDate(futuras[0].data_vencimento);
        const ate = formatDate(futuras[futuras.length - 1].data_vencimento);
        const msg = `Este contrato tem ${futuras.length} receita(s) futura(s) em aberto (${de} a ${ate}).\n\nApagar? As já recebidas não são mexidas.`;
        if (window.confirm(msg)) {
          const { error } = await supabase.from('receitas').delete().in('id', futuras.map((f) => f.id));
          if (error) toast.error('Erro ao apagar as receitas futuras', { description: error.message });
          else toast.success(`${futuras.length} receita(s) futura(s) apagada(s).`);
        }
      }
    }

    setModalOpen(false);
    setIsSaving(false);
    setNovoContratoCobranca(false);
    setNcForma('UNDEFINED');
    setNcConta('');
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cliente_id || !formData.descricao || !formData.valor) return;

    if (formData.recorrencia !== 'unico' && !formData.dia_vencimento) {
      return;
    }

    const dataInativacao = formData.status !== 'ativo'
      ? (formData.data_inativacao || new Date().toISOString().split('T')[0])
      : undefined;

    const data: ContratoFormData = {
      cliente_id: formData.cliente_id,
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      data_inicio: formData.data_inicio,
      data_fim: formData.data_fim || undefined,
      dia_vencimento: formData.recorrencia !== 'unico'
        ? parseInt(formData.dia_vencimento) || undefined
        : undefined,
      recorrencia: formData.recorrencia,
      status: formData.status,
      data_inativacao: dataInativacao,
    };

    // Duplicate detection — only on creation of active recurring/unique contracts
    if (!editingContrato && data.status === 'ativo') {
      const match = findPossibleDuplicate(
        { cliente_id: data.cliente_id, descricao: data.descricao, recorrencia: data.recorrencia, valor: data.valor },
        contratos
      );
      if (match) {
        setDuplicateMatch(match);
        setPendingSubmitData(data);
        return;
      }
    }

    await persistContrato(data);
  };

  // Confirm duplicate dialog actions
  const handleApplyAsAditivo = async () => {
    if (!duplicateMatch || !pendingSubmitData) return;
    setIsSaving(true);
    const ok = await createAditivo(
      duplicateMatch.contrato.id,
      Number(duplicateMatch.contrato.valor),
      {
        valor_novo: pendingSubmitData.valor,
        data_vigencia: pendingSubmitData.data_inicio,
        motivo: 'Reajuste de valor',
      }
    );
    if (ok) {
      await refetchContratos();
      setDuplicateMatch(null);
      setPendingSubmitData(null);
      setModalOpen(false);
    }
    setIsSaving(false);
  };

  const handleCreateAnyway = async () => {
    if (!pendingSubmitData) return;
    const data = pendingSubmitData;
    setDuplicateMatch(null);
    setPendingSubmitData(null);
    await persistContrato(data);
  };


  // Handle delete
  const handleDelete = async () => {
    if (!deletingId) return;
    
    setIsSaving(true);
    const success = await deleteContrato(deletingId);
    if (success) {
      setDeleteDialogOpen(false);
    }
    setIsSaving(false);
    setDeletingId(null);
  };

  const activeClientes = clientes.filter(c => c.status === 'ativo');

  return (
    <main className="container py-4 md:py-6">
        {/* Page Header */}
        <MobilePageHeader
          eyebrow="Gestão · Recorrência"
          title="Contratos"
          actions={
            <>
              <IconButton label="Sincronizar cobranças (Asaas)" onClick={() => sincronizarCobrancas()} disabled={cobrLoading} className="h-10 w-10 rounded-full">
                <RefreshCw className={cn('h-4 w-4', cobrLoading && 'animate-spin')} />
              </IconButton>
              <IconButton label="Importar contrato (PDF)" onClick={() => setImportDialogOpen(true)} className="h-10 w-10 rounded-full">
                <Upload className="h-4 w-4" />
              </IconButton>
              <Button onClick={handleNew} className="gap-1.5" aria-label="Novo Contrato">
                <Plus className="h-4 w-4" />
                <span className="sm:hidden">Novo</span>
                <span className="hidden sm:inline">Novo contrato</span>
              </Button>
            </>
          }
        />

        {/* Resumo — 3 KPIs colados; MRR é a célula navy de destaque */}
        <KpiTriple
          className="md:mb-6"
          items={[
            { label: 'Ativos', value: totals.ativos, tone: 'green', format: 'count' },
            { label: 'Valor Total', value: totals.valorTotal, tone: 'amber' },
            { label: 'MRR Total', value: totals.mrrTotal, tone: 'steel' },
          ]}
        />

        {/* Banner: existing duplicate active contracts */}
        {duplicateGroups.length > 0 && (
          <SectionCard className="mb-4 md:mb-6" flush>
            <div className="flex items-start gap-3 px-4 pt-4 md:px-6 md:pt-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-warning-bg text-warning-fg">
                <AlertTriangle className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground">
                  {duplicateGroups.length === 1
                    ? '1 possível contrato duplicado'
                    : `${duplicateGroups.length} possíveis contratos duplicados`} inflando o MRR
                </p>
                <p className="mt-0.5 text-[12.5px] text-foreground-muted">
                  Mescle para manter apenas um contrato vigente por serviço/cliente. Os demais serão encerrados.
                </p>
              </div>
            </div>
            <div className="mt-2 px-4 pb-1 md:px-6">
              {duplicateGroups.map((group, idx) => (
                <div
                  key={`${group.cliente_id}-${idx}`}
                  className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <InitialsAvatar nome={group.cliente_nome} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-foreground">{group.cliente_nome}</div>
                    <div className="truncate text-[12px] text-foreground-muted">
                      {group.contratos.map(c => `${c.descricao} (${formatCurrency(Number(c.valor))})`).join(' • ')}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openMergeDialog(group)} className="shrink-0">
                    Resolver
                  </Button>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Filtros: status em pílulas + busca */}
        <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-center md:justify-between">
          <ScrollPills aria-label="Filtrar por status">
            <Pill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Todos</Pill>
            {STATUS_OPTIONS.map(option => (
              <Pill key={option.value} active={statusFilter === option.value} onClick={() => setStatusFilter(option.value)}>
                {option.label}
              </Pill>
            ))}
          </ScrollPills>
          <div className="relative md:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <Input
              type="search"
              placeholder="Buscar por descrição ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-full bg-surface pl-10"
            />
          </div>
        </div>

        {/* Table / Mobile List */}
        {isMobile ? (
          <MobileContratosList
            contratos={filteredContratos as any}
            isLoading={isLoading}
            onEdit={(c: any) => handleEdit(c)}
            onDelete={(id) => { setDeletingId(id); setDeleteDialogOpen(true); }}
            onNew={handleNew}
            renderCobranca={(c: any) => (
              <ContratoCobrancaCell
                contratoId={c.id}
                cobranca={cobrancaDoContrato(c.id)}
                busy={cobrBusyId === c.id || cobrBusyId === cobrancaDoContrato(c.id)?.id}
                contas={contasRecebimento}
                clienteNome={c.cliente?.nome || c.cliente_nome || ''}
                contratoDescricao={c.descricao}
                contratoValor={c.valor}
                onCobrar={(forma, contaId, extra) => criarCobranca(c.id, forma, contaId, extra)}
                onListarAssinaturas={() => listarAssinaturas(c.cliente_id)}
                onVincular={async (subId, contaId) => { await vincularAssinatura(c.id, subId, contaId); refetchContratos(); }}
                onDesvincular={() => setDesvincularAlvo({ id: c.id, nome: c.cliente?.nome || c.descricao || 'contrato' })}
                onCancelar={() => { const cb = cobrancaDoContrato(c.id); if (cb) cancelarCobranca(cb.id); }}
                onExcluir={() => { const cb = cobrancaDoContrato(c.id); if (cb) excluirCobranca(cb.id); }}
                onSincronizar={() => sincronizarCobrancas(c.id)}
                onReceberManual={() => { const cb = cobrancaDoContrato(c.id); if (cb) receberManualCobranca(cb.id); }}
                onWhatsapp={() => openWhatsapp(cobrancaDoContrato(c.id))}
                grupoQtd={(() => { const cb = cobrancaDoContrato(c.id); return cb ? linhasDaFatura(cb).length : 1; })()}
              />
            )}
          />
        ) : (
        <SectionCard flush className="overflow-hidden">
          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : filteredContratos.length === 0 ? (
            <EmptyState
              title="Nenhum contrato encontrado"
              description="Crie seu primeiro contrato para acompanhar seus acordos com clientes."
              action={
                <Button onClick={handleNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Contrato
                </Button>
              }
            />
          ) : (
            <Table className="min-w-[1080px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 pl-5 md:pl-6">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                      className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                    />
                  </TableHead>
                  <TableHead className="min-w-[220px]"><SortBtn label="Cliente" onClick={() => toggleSort('cliente')} icon={sortIcon('cliente')} /></TableHead>
                  <TableHead className="min-w-[240px]"><SortBtn label="Descrição" onClick={() => toggleSort('descricao')} icon={sortIcon('descricao')} /></TableHead>
                  <TableHead className="w-[130px]"><SortBtn label="Recorrência" onClick={() => toggleSort('recorrencia')} icon={sortIcon('recorrencia')} /></TableHead>
                  <TableHead className="w-[140px] text-right"><SortBtn label="Valor" onClick={() => toggleSort('valor')} icon={sortIcon('valor')} align="right" /></TableHead>
                  <TableHead className="w-[110px]"><SortBtn label="Início" onClick={() => toggleSort('inicio')} icon={sortIcon('inicio')} /></TableHead>
                  <TableHead className="w-[110px]"><SortBtn label="Status" onClick={() => toggleSort('status')} icon={sortIcon('status')} /></TableHead>
                  <TableHead className="w-[160px]">Cobrança</TableHead>
                  <TableHead className="w-[100px] pr-5 text-right md:pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContratos.map(contrato => (
                  <TableRow
                    key={contrato.id}
                    data-state={isSelected(contrato.id) ? 'selected' : undefined}
                    className="border-b border-border"
                  >
                    <TableCell className="pl-5 md:pl-6">
                      <Checkbox
                        checked={isSelected(contrato.id)}
                        onCheckedChange={() => toggleSelect(contrato.id)}
                        aria-label={`Selecionar ${contrato.descricao}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <InitialsAvatar nome={contrato.cliente?.nome} className="h-9 w-9 rounded-[12px] text-[12px]" />
                        <span className="truncate font-semibold text-foreground">{contrato.cliente?.nome || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-foreground-muted">{contrato.descricao}</TableCell>
                    <TableCell>
                      <StatusBadge status={contrato.recorrencia} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="whitespace-nowrap font-heading font-semibold tabular-nums tracking-[-0.02em] text-[hsl(var(--success-fg))]">{formatCurrency(Number(contrato.valor))}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-foreground-muted">{formatDate(contrato.data_inicio)}</TableCell>
                    <TableCell>
                      <StatusBadge status={contrato.status === 'ativo' && estadoPausa(contrato) === 'pausado' ? 'pausado' : contrato.status} />
                    </TableCell>
                    <TableCell>
                      <ContratoCobrancaCell
                        contratoId={contrato.id}
                        cobranca={cobrancaDoContrato(contrato.id)}
                        busy={cobrBusyId === contrato.id || cobrBusyId === cobrancaDoContrato(contrato.id)?.id}
                        contas={contasRecebimento}
                        clienteNome={contrato.cliente?.nome || ''}
                        contratoDescricao={contrato.descricao}
                        contratoValor={contrato.valor}
                        onCobrar={(forma, contaId, extra) => criarCobranca(contrato.id, forma, contaId, extra)}
                        onListarAssinaturas={() => listarAssinaturas(contrato.cliente_id)}
                        onVincular={async (subId, contaId) => { await vincularAssinatura(contrato.id, subId, contaId); refetchContratos(); }}
                        onDesvincular={() => setDesvincularAlvo({ id: contrato.id, nome: contrato.cliente?.nome || contrato.descricao || 'contrato' })}
                        onCancelar={() => { const c = cobrancaDoContrato(contrato.id); if (c) cancelarCobranca(c.id); }}
                        onExcluir={() => { const c = cobrancaDoContrato(contrato.id); if (c) excluirCobranca(c.id); }}
                        onSincronizar={() => sincronizarCobrancas(contrato.id)}
                        onReceberManual={() => { const c = cobrancaDoContrato(contrato.id); if (c) receberManualCobranca(c.id); }}
                        onWhatsapp={() => openWhatsapp(cobrancaDoContrato(contrato.id))}
                        grupoQtd={(() => { const cb = cobrancaDoContrato(contrato.id); return cb ? linhasDaFatura(cb).length : 1; })()}
                      />
                    </TableCell>
                    <TableCell className="pr-5 md:pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Editar contrato" onClick={() => handleEdit(contrato)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-danger-bg" aria-label="Excluir contrato" onClick={() => { setDeletingId(contrato.id); setDeleteDialogOpen(true); }}>
                          <Trash2 className="h-4 w-4 text-[hsl(var(--danger-fg))]" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
        )}

        {/* Create/Edit Modal */}
        <Sheet open={modalOpen} onOpenChange={setModalOpen}>
          <SheetContent side="bottom" showHandle className="p-0 max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[560px] sm:mx-auto">
            <SheetHeading
              className="px-5 pt-1"
              eyebrow="Cadastro"
              title={editingContrato ? 'Editar contrato' : 'Novo contrato'}
            />

            <form onSubmit={handleSubmit} className="space-y-6 p-5 pt-4">
              {/* ===== Cliente e serviço ===== */}
              <FormSection
                label="Cliente e serviço"
                action={
                  <div className="flex items-center gap-3">
                    {formData.cliente_id && !novoClienteOpen && (
                      <button
                        type="button"
                        onClick={() => setEditarClienteOpen(true)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Pencil className="h-3 w-3" /> Editar cadastro
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setNovoClienteOpen(v => !v)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {novoClienteOpen ? 'Cancelar' : '+ Novo cliente'}
                    </button>
                  </div>
                }
              >
                <div className="space-y-1.5">
                  <Label htmlFor="cliente_id">Cliente</Label>
                  {novoClienteOpen ? (
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        value={novoClienteNome}
                        onChange={(e) => setNovoClienteNome(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCriarClienteInline(); } }}
                        placeholder="Nome do novo cliente"
                      />
                      <Button type="button" size="lg" onClick={handleCriarClienteInline} disabled={criandoCliente || !novoClienteNome.trim()}>
                        {criandoCliente ? 'Criando…' : 'Criar'}
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={formData.cliente_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, cliente_id: value }))}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeClientes.map(cliente => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="descricao">Descrição *</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Descrição do contrato..."
                    rows={2}
                    required
                  />
                </div>
              </FormSection>

              {/* ===== Valor e recorrência ===== */}
              <FormSection label="Valor e recorrência">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="valor">Valor *</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.valor}
                      onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                      placeholder="0,00"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="recorrencia">Recorrência</Label>
                    <Select
                      value={formData.recorrencia}
                      onValueChange={(value: typeof formData.recorrencia) => setFormData(prev => ({ ...prev, recorrencia: value }))}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECORRENCIA_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Conditional: Dia de Vencimento for recurring contracts */}
                {formData.recorrencia !== 'unico' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="dia_vencimento" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-foreground-muted" />
                      Dia de Vencimento *
                    </Label>
                    <Input
                      id="dia_vencimento"
                      type="number"
                      min="1"
                      max="31"
                      value={formData.dia_vencimento}
                      onChange={(e) => setFormData(prev => ({ ...prev, dia_vencimento: e.target.value }))}
                      placeholder="Ex: 10"
                      required
                    />
                    <p className="text-[11.5px] text-foreground-muted">
                      Dia do mês para cobrança (1-31)
                    </p>
                  </div>
                )}

                {/* Conditional: Parcelas for unique contracts */}
                {formData.recorrencia === 'unico' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="num_parcelas" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-foreground-muted" />
                        Número de Parcelas
                      </Label>
                      <Input
                        id="num_parcelas"
                        type="number"
                        min="1"
                        max="60"
                        value={formData.num_parcelas}
                        onChange={(e) => setFormData(prev => ({ ...prev, num_parcelas: e.target.value }))}
                      />
                    </div>

                    {parcelas.length > 0 && (
                      <div className="space-y-1.5">
                        <Label>Parcelas</Label>
                        <div className="overflow-hidden rounded-[20px] border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs font-medium text-foreground-muted">
                                <th className="px-3 py-2.5">#</th>
                                <th className="px-3 py-2.5">Vencimento</th>
                                <th className="px-3 py-2.5 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parcelas.map((parcela, index) => (
                                <tr key={index} className="border-t border-border">
                                  <td className="px-3 py-2 text-foreground-muted">
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
                                      className="w-full"
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
                                      className="w-24 text-right"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-border bg-surface-2 font-medium">
                                <td colSpan={2} className="px-3 py-2.5">Total</td>
                                <td className="px-3 py-2.5 text-right font-heading font-semibold tabular-nums">
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
              </FormSection>

              {/* ===== Vigência ===== */}
              <FormSection label="Vigência">
                <div className="grid grid-cols-2 gap-3">
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

                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <div className="grid grid-cols-3 gap-1 rounded-full border border-border bg-surface p-1">
                    {(['ativo', 'encerrado', 'cancelado'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                        className={cn(
                          'no-touch-min h-9 rounded-full text-[13px] font-semibold transition-colors',
                          formData.status === s ? 'bg-foreground text-background' : 'text-foreground-muted hover:text-foreground',
                        )}
                      >
                        {s === 'ativo' ? 'Ativo' : s === 'encerrado' ? 'Encerrado' : 'Cancelado'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Data de Inativação - only when status is not ativo */}
                {formData.status !== 'ativo' && (
                  <div className="space-y-1.5">
                    <DatePickerField
                      label="Data de Inativação"
                      value={formData.data_inativacao}
                      onChange={(d) => setFormData(prev => ({ ...prev, data_inativacao: d }))}
                    />
                    <p className="text-[11.5px] text-foreground-muted">
                      Data efetiva de encerramento/cancelamento. Se não informada, será usada a data atual.
                    </p>
                  </div>
                )}
              </FormSection>

              {/* ===== Pausa (só na edição de contrato ativo e recorrente) ===== */}
              {(() => {
                const atual = editingContratoId ? contratos.find(c => c.id === editingContratoId) : undefined;
                if (!atual || atual.status !== 'ativo' || atual.recorrencia === 'unico') return null;
                return <PausaContrato key={`${atual.id}-${atual.pausado_desde}-${atual.pausado_ate}`} contrato={atual} onChange={() => refetchContratos()} />;
              })()}

              {/* ===== Criar cobrança no Asaas junto com o contrato (só na criação, recorrente) ===== */}
              {!editingContrato && formData.recorrencia !== 'unico' && (
                <FormSection label="Cobrança no Asaas">
                  <div className="rounded-[20px] border border-border p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="flex items-center gap-2.5 text-sm font-semibold">
                        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-info-bg text-info-fg"><Zap className="h-4 w-4" /></span>
                        Criar cobrança no Asaas
                      </Label>
                      <Switch checked={novoContratoCobranca} onCheckedChange={setNovoContratoCobranca} />
                    </div>
                    {novoContratoCobranca && (
                      <div className="mt-4 space-y-3.5 border-t border-border pt-3.5">
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-foreground-muted">Forma de pagamento</Label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[['UNDEFINED', 'Cliente escolhe'], ['PIX', 'Pix'], ['BOLETO', 'Boleto'], ['CREDIT_CARD', 'Cartão']].map(([v, l]) => (
                              <ChoiceChip key={v} active={ncForma === v} onClick={() => setNcForma(v)}>{l}</ChoiceChip>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-foreground-muted">Conta de recebimento</Label>
                          <select value={ncConta} onChange={(e) => setNcConta(e.target.value)} className={NATIVE_SELECT_CLS}>
                            <option value="">Sem conta (defino depois)</option>
                            {contasRecebimento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5"><Label className="text-[12px] text-foreground-muted">Multa atraso (%)</Label><Input type="number" step="0.01" min="0" value={ncMulta} onChange={(e) => setNcMulta(e.target.value)} placeholder="0" /></div>
                          <div className="space-y-1.5"><Label className="text-[12px] text-foreground-muted">Juros ao mês (%)</Label><Input type="number" step="0.01" min="0" value={ncJuros} onChange={(e) => setNcJuros(e.target.value)} placeholder="0" /></div>
                        </div>
                        <p className="text-[11.5px] leading-snug text-foreground-muted">Cria a assinatura no Asaas e lança a receita a receber. Multa/juros só incidem se atrasar — juros é <b>ao mês</b> (proporcional aos dias). O juros/multa recebido entra como receita extra na baixa.</p>
                      </div>
                    )}
                  </div>
                </FormSection>
              )}

              {/* ===== Cobrança automática (exceção) + exigir nota fiscal — por contrato ===== */}
              {formData.recorrencia !== 'unico' && (
                <FormSection label="Cobrança automática (WhatsApp)">
                  <div className="grid grid-cols-3 gap-1 rounded-full border border-border bg-surface p-1">
                    {[['padrao', 'Padrão'], ['off', 'Desligado'], ['custom', 'Personalizado']].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setCaModo(v as 'padrao' | 'off' | 'custom')} className={cn('no-touch-min h-9 rounded-full text-[12.5px] font-semibold transition-colors', caModo === v ? 'bg-foreground text-background' : 'text-foreground-muted hover:text-foreground')}>{l}</button>
                    ))}
                  </div>
                  <p className="text-[11.5px] text-foreground-muted">
                    {caModo === 'padrao' ? 'Usa a regra global (Meu Perfil).' : caModo === 'off' ? 'Nunca dispara automático para este contrato.' : 'Define uma regra só para este contrato.'}
                  </p>
                  <div className="rounded-[20px] border border-border px-3.5">
                    {caModo === 'custom' && (
                      <>
                        <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
                          <Label className="text-[13px] font-normal">Enviar <b>X dias antes</b></Label>
                          <Input type="number" min="0" value={caAntes} onChange={(e) => setCaAntes(e.target.value)} placeholder="0" className="w-20 text-center" />
                        </div>
                        <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border py-2.5">
                          <Label className="text-[13px] font-normal">Enviar <b>no dia</b></Label>
                          <Switch checked={caNoDia} onCheckedChange={setCaNoDia} />
                        </div>
                        <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border py-2.5">
                          <Label className="text-[13px] font-normal">Reenviar <b>todo dia em atraso</b></Label>
                          <Switch checked={caAtraso} onCheckedChange={setCaAtraso} />
                        </div>
                      </>
                    )}
                    <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border py-2.5">
                      <Label className="text-[13px] font-normal">Exigir <b>nota fiscal (PDF)</b> para disparar</Label>
                      <Switch checked={caExigirNf} onCheckedChange={setCaExigirNf} />
                    </div>
                    <div className="flex min-h-[52px] items-center justify-between gap-3 py-2.5">
                      <Label className="text-[13px] font-normal">No WhatsApp, enviar <b>chave PIX</b> (não o link Asaas)</Label>
                      <Switch checked={caEnvioPix} onCheckedChange={setCaEnvioPix} />
                    </div>
                  </div>
                  <p className="text-[11.5px] text-foreground-muted">Vale para as próximas cobranças geradas deste contrato. A chave PIX é a de Meu Perfil; a baixa é pelo "Identificar pagamento manual".</p>
                </FormSection>
              )}

              {/* ===== Histórico de reajustes (edição) ===== */}
              {editingContrato && (
                <FormSection
                  label={<span className="inline-flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Histórico de Reajustes</span>}
                  action={!showAditivoForm && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextMonth = new Date();
                        nextMonth.setMonth(nextMonth.getMonth() + 1);
                        nextMonth.setDate(1);
                        setAditivoData({
                          valor_novo: '',
                          data_vigencia: nextMonth.toISOString().split('T')[0],
                          motivo: '',
                        });
                        setShowAditivoForm(true);
                      }}
                      className="gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Novo Reajuste
                    </Button>
                  )}
                >
                  {showAditivoForm && (
                    <div className="space-y-3 rounded-[20px] border border-border p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">Novo Reajuste</span>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Fechar novo reajuste" onClick={() => setShowAditivoForm(false)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-foreground-muted">Novo Valor *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={aditivoData.valor_novo}
                            onChange={(e) => setAditivoData(prev => ({ ...prev, valor_novo: e.target.value }))}
                            placeholder="0,00"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[12px] text-foreground-muted">Vigência a partir de *</Label>
                          <DatePickerField
                            label=""
                            value={aditivoData.data_vigencia}
                            onChange={(d) => setAditivoData(prev => ({ ...prev, data_vigencia: d }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[12px] text-foreground-muted">Motivo</Label>
                        <Input
                          value={aditivoData.motivo}
                          onChange={(e) => setAditivoData(prev => ({ ...prev, motivo: e.target.value }))}
                          placeholder="Ex: mais usuários + novo serviço"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleSaveAditivo}
                        disabled={isSaving || !aditivoData.valor_novo || !aditivoData.data_vigencia}
                        className="w-full"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar Reajuste'}
                      </Button>
                    </div>
                  )}

                  {aditivosLoading ? (
                    <p className="text-xs text-foreground-muted">Carregando...</p>
                  ) : aditivos.length === 0 ? (
                    <p className="text-xs text-foreground-muted">Nenhum reajuste registrado.</p>
                  ) : (
                    <div className="rounded-[20px] border border-border px-3.5">
                      {aditivos.map(aditivo => (
                        <div key={aditivo.id} className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-b-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums text-foreground-muted line-through">
                                {formatCurrency(Number(aditivo.valor_anterior))}
                              </span>
                              <span className="text-foreground">→</span>
                              <span className="font-heading font-semibold tabular-nums text-foreground">
                                {formatCurrency(Number(aditivo.valor_novo))}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[12px] text-foreground-muted">
                              <span>A partir de {formatDate(aditivo.data_vigencia)}</span>
                              {aditivo.motivo && <span className="truncate">• {aditivo.motivo}</span>}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-full hover:bg-danger-bg"
                            aria-label="Excluir reajuste"
                            onClick={() => deleteAditivo(aditivo.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[hsl(var(--danger-fg))]" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </FormSection>
              )}

              <SheetFooter className="border-t border-border pt-4">
                <Button type="button" variant="outline" size="lg" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="lg" disabled={isSaving}>
                  {isSaving ? 'Salvando…' : (editingContrato ? 'Atualizar' : 'Criar')}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>

        {/* Desvincular do Asaas */}
        <ConfirmDialog
          open={!!desvincularAlvo}
          onOpenChange={(o) => !o && setDesvincularAlvo(null)}
          title="Desvincular do Asaas"
          description={`Desfazer o vínculo de "${desvincularAlvo?.nome || 'contrato'}" com a assinatura do Asaas? As cobranças em aberto geradas aqui serão canceladas e o contrato volta a poder ser cobrado de novo. A assinatura continua existindo no Asaas (não é cancelada lá).`}
          confirmLabel="Desvincular"
          onConfirm={async () => {
            if (desvincularAlvo) { await desvincularAssinatura(desvincularAlvo.id); await refetchContratos(); }
            setDesvincularAlvo(null);
          }}
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir Contrato"
          description="Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={isSaving}
        />

        {/* Bulk Delete Confirmation */}
        <ConfirmDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          title="Excluir Contratos"
          description={`Tem certeza que deseja excluir ${selectedIds.size} contratos? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir Todos"
          variant="destructive"
          onConfirm={handleBulkDelete}
          isLoading={isSaving}
        />

        {/* Multi-select bar */}
        <MultiSelectBar
          selectedCount={selectedIds.size}
          onClear={clearSelection}
          onDelete={() => setBulkDeleteDialogOpen(true)}
          onExport={handleExport}
          customActions={selectedIds.size >= 2 ? [{
            label: 'Cobrar juntos',
            icon: <Layers className="h-4 w-4" />,
            onClick: () => setAgruparOpen(true),
          }] : undefined}
        />

        <EditarClienteSheet
          open={editarClienteOpen}
          onOpenChange={setEditarClienteOpen}
          cliente={clientes.find((c) => c.id === formData.cliente_id) ?? null}
          onSalvar={updateCliente}
        />

        <AgruparCobrancaSheet
          open={agruparOpen}
          onOpenChange={setAgruparOpen}
          contratos={contratosParaAgrupar}
          nomeCliente={(id) => clientes.find((c) => c.id === id)?.nome || '—'}
          contas={contasRecebimento}
          listarAssinaturas={listarAssinaturas}
          agrupar={async (p) => {
            const ok = await agruparContratos(p);
            if (ok) { clearSelection(); refetchContratos(); }
            return ok;
          }}
        />

        {/* Contract Import Dialog */}
        <ContractImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportComplete={() => {
            // Refetch will happen automatically via React Query
          }}
        />

        {/* Enviar cobrança por WhatsApp (mensagem editável) */}
        <Sheet open={whatsappOpen} onOpenChange={setWhatsappOpen}>
          <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[520px] sm:mx-auto">
            <SheetHeading eyebrow="Cobrança" title="Enviar por WhatsApp" />
            <div className="space-y-6 pt-3">
              <FormSection label="Destinatário">
                <div className="space-y-1.5">
                  <Label>WhatsApp do cliente</Label>
                  <Input value={whatsappTel} onChange={(e) => setWhatsappTel(e.target.value)} placeholder="(65) 99902-0102" />
                  <p className="text-[11.5px] text-foreground-muted">Vem do cadastro do cliente. Enviamos com DDI+DDD, sem o nono dígito.</p>
                </div>
              </FormSection>
              <FormSection label="Mensagem">
                <div className="space-y-1.5">
                  <Label className="sr-only">Mensagem</Label>
                  <Textarea value={whatsappText} onChange={(e) => setWhatsappText(e.target.value)} rows={10} className="font-mono text-[13px] leading-relaxed" />
                  <p className="text-[11.5px] text-foreground-muted">Aceita *negrito*, _itálico_ e quebra de linha. Edite à vontade — o padrão vem de Meu Perfil.</p>
                </div>
                {whatsappNotas.length ? (
                  <InlineNotice tone="neutral" icon={<FileText className="text-primary" />}>
                    <span className="block">Vai anexar {whatsappNotas.length > 1 ? `${whatsappNotas.length} notas fiscais:` : 'a nota fiscal:'}</span>
                    {whatsappNotas.map((n) => <span key={n.path} className="block truncate text-foreground-muted">{n.nome}</span>)}
                  </InlineNotice>
                ) : whatsappBloqueado ? (
                  <InlineNotice tone="warning" icon={<FileText />}>
                    Esta cobrança exige nota fiscal anexada. Anexe na tela de Cobranças.
                  </InlineNotice>
                ) : null}
              </FormSection>
              <SheetFooter>
                <Button variant="outline" size="lg" onClick={() => setWhatsappOpen(false)}>Cancelar</Button>
                <Button size="lg" onClick={handleEnviarWhatsapp} disabled={whatsappSending || whatsappBloqueado || !whatsappTel.trim() || !whatsappText.trim()}>
                  {whatsappSending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Enviar
                </Button>
              </SheetFooter>
            </div>
          </SheetContent>
        </Sheet>

        {/* Duplicate contract detection dialog */}
        <Dialog
          open={!!duplicateMatch}
          onOpenChange={(open) => {
            if (!open) {
              setDuplicateMatch(null);
              setPendingSubmitData(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Contrato similar já existe</DialogTitle>
            </DialogHeader>
            {duplicateMatch && pendingSubmitData && (
              <div className="space-y-4">
                <p className="text-sm text-foreground-muted">
                  Encontramos um contrato ativo parecido para <strong className="text-foreground">{duplicateMatch.contrato.cliente?.nome}</strong>:
                </p>
                <div className="flex items-center gap-3 rounded-[20px] border border-border p-3.5">
                  <InitialsAvatar nome={duplicateMatch.contrato.cliente?.nome} />
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    <div className="truncate font-semibold text-foreground">{duplicateMatch.contrato.descricao}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[12.5px]">
                      <span className="text-foreground-muted">Valor atual:</span>
                      <span className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(Number(duplicateMatch.contrato.valor))}</span>
                      {!duplicateMatch.sameValue && (
                        <>
                          <span className="text-foreground-muted">→</span>
                          <span className="font-heading font-semibold tabular-nums text-primary">
                            {formatCurrency(pendingSubmitData.valor)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {duplicateMatch.sameValue ? (
                  <p className="text-sm text-foreground">
                    O valor é igual ao do contrato existente. Tem certeza que deseja criar um novo contrato?
                  </p>
                ) : (
                  <p className="text-sm text-foreground">
                    Parece um <strong>reajuste de valor</strong>. Recomendamos registrar como Aditivo no contrato existente para preservar o histórico e não duplicar o MRR.
                  </p>
                )}
                <div className="flex flex-col gap-2 pt-1">
                  {!duplicateMatch.sameValue && (
                    <Button size="lg" onClick={handleApplyAsAditivo} disabled={isSaving} className="w-full">
                      {isSaving ? 'Aplicando...' : 'Registrar como Aditivo (recomendado)'}
                    </Button>
                  )}
                  <Button size="lg" variant="outline" onClick={handleCreateAnyway} disabled={isSaving} className="w-full">
                    Criar novo contrato mesmo assim
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setDuplicateMatch(null); setPendingSubmitData(null); }}
                    disabled={isSaving}
                    className="w-full"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Merge duplicate contracts dialog */}
        <Dialog
          open={!!mergeGroup}
          onOpenChange={(open) => {
            if (!open) { setMergeGroup(null); setKeepContratoId(null); }
          }}
        >
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>Mesclar contratos duplicados</DialogTitle>
            </DialogHeader>
            {mergeGroup && (
              <div className="space-y-5">
                <p className="text-sm text-foreground-muted">
                  Escolha qual contrato de <strong className="text-foreground">{mergeGroup.cliente_nome}</strong> deve permanecer ativo. Os demais serão <strong className="text-foreground">encerrados</strong> e seus lançamentos pendentes futuros serão removidos.
                </p>
                <FormSection label="Contrato que permanece">
                  <div className="space-y-2">
                    {mergeGroup.contratos.map(c => (
                      <label
                        key={c.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-[20px] border p-3.5 transition-colors',
                          keepContratoId === c.id ? 'border-foreground bg-surface-2' : 'border-border hover:border-border-strong'
                        )}
                      >
                        <input
                          type="radio"
                          name="keepContrato"
                          checked={keepContratoId === c.id}
                          onChange={() => setKeepContratoId(c.id)}
                          className="mt-1 accent-[hsl(var(--foreground))]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground">{c.descricao}</div>
                          <div className="text-[12px] text-foreground-muted">
                            Início {formatDate(c.data_inicio)} • <span className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(Number(c.valor))}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </FormSection>
                <p className="text-[12px] text-foreground-muted">
                  Dica: mantenha o contrato com o valor mais atual. Se algum reajuste do encerrado fizer sentido como histórico, ele será anotado como aditivo.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => { setMergeGroup(null); setKeepContratoId(null); }} disabled={isMerging}>
                    Cancelar
                  </Button>
                  <Button onClick={handleMergeDuplicates} disabled={isMerging || !keepContratoId}>
                    {isMerging ? 'Mesclando...' : 'Mesclar contratos'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

    </main>
  );
}

function SortBtn({ label, onClick, icon, align = 'left' }: { label: string; onClick: () => void; icon: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 hover:text-foreground', align === 'right' && 'ml-auto flex-row-reverse')}>
      {label} {icon}
    </button>
  );
}

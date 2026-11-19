import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActionParam } from '@/hooks/useActionParam';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SkeletonTable } from '@/components/shared/LoadingSpinner';
import { MultiSelectBar } from '@/components/shared/MultiSelectBar';
import { FormSection, InitialsAvatar, InlineNotice, iniciais } from '@/components/cobrancas/formParts';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
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
import {
  Plus, Pencil, Trash2, FileText, RefreshCw, Upload, X, Zap, ChevronDown, Loader2, Layers, ArrowUpDown, BellRing,
  CalendarDays, Check, Download, FileSignature, MoreHorizontal, Pause, AlertTriangle, Search,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ContractImportDialog } from '@/components/import/ContractImportDialog';
import { useContratoAditivos } from '@/hooks/useContratoAditivos';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { PausaContrato } from '@/components/contratos/PausaContrato';
import { CancelarCobrancaDialog } from '@/components/cobrancas/CancelarCobrancaDialog';
import { estadoPausa } from '@/lib/pausaContrato';
import { findPossibleDuplicate, findDuplicateGroups, type DuplicateMatch, type DuplicateGroup } from '@/utils/contractDuplicates';
import { isContratoAtivoHoje, getValorMensalEquivalente } from '@/utils/contractUtils';
import { Campo, ModalFooter, ModalHeader, ModalShell, PageHeader, Secao, Segmented } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';

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

type FiltroStatus = 'ativo' | 'pausado' | 'encerrado' | 'cancelado' | 'all';
const FILTROS_STATUS: [FiltroStatus, string][] = [['ativo', 'Ativos'], ['pausado', 'Pausados'], ['encerrado', 'Encerrados'], ['cancelado', 'Cancelados'], ['all', 'Todos']];
const ST_LABEL: Record<string, string> = { ativo: 'Ativo', pausado: 'Pausado', encerrado: 'Encerrado', cancelado: 'Cancelado' };
const ST_CLS: Record<string, string> = {
  ativo: 'bg-success-bg text-success-fg', pausado: 'bg-warning-bg text-warning-fg',
  encerrado: 'bg-surface-2 text-foreground-muted', cancelado: 'bg-danger-bg text-danger-fg',
};
const REC_LABEL: Record<string, string> = {
  semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual', unico: 'Único / parcelado',
};
const REC_RESUMO: Record<string, string> = {
  semanal: 'por semana', quinzenal: 'a cada 15 dias', mensal: 'por mês', trimestral: 'por trimestre', semestral: 'por semestre', anual: 'por ano', unico: 'valor total (em parcelas)',
};
const MENU_ITEM = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-foreground hover:bg-surface-2';
const CORES_AVATAR = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700'];
const corAvatar = (n: string) => CORES_AVATAR[[...n].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % CORES_AVATAR.length];
const hojeISO = () => new Date().toLocaleDateString('en-CA');

export default function Contratos() {
  const navigate = useNavigate();
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
    cancelarSoEsta: cancelarSoEstaCobranca,
    removerDoHistorico: removerCobrancaDoHistorico,
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
  // Próxima cobrança: a pendente do Asaas, senão o próximo "dia de vencimento".
  const proximaCobranca = (c: { id: string; status: string; recorrencia: string; dia_vencimento?: number | null; pausado_desde?: string | null; pausado_ate?: string | null }): string | null => {
    if (c.status !== 'ativo' || c.recorrencia === 'unico' || estadoPausa(c) === 'pausado') return null;
    const hoje = hojeISO();
    const cob = cobrancaDoContrato(c.id);
    if (cob && (cob.status === 'pendente' || cob.status === 'vencido') && cob.vencimento) return cob.vencimento;
    if (!c.dia_vencimento) return null;
    const d = new Date(`${hoje}T12:00:00`);
    for (let k = 0; k < 2; k++) {
      const ano = d.getFullYear(), mes = d.getMonth() + k;
      const ultimo = new Date(ano, mes + 1, 0).getDate();
      const alvo = new Date(ano, mes, Math.min(c.dia_vencimento, ultimo)).toLocaleDateString('en-CA');
      if (alvo >= hoje) return alvo;
    }
    return null;
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
  const [cancelandoCob, setCancelandoCob] = useState<{ cob: Cobranca; nome: string } | null>(null);
  const { aditivos, isLoading: aditivosLoading, createAditivo, deleteAditivo } = useContratoAditivos(editingContratoId);
  const [showAditivoForm, setShowAditivoForm] = useState(false);
  const [aditivoData, setAditivoData] = useState<{ valor_novo: string; data_vigencia: string; motivo: string }>({
    valor_novo: '',
    data_vigencia: '',
    motivo: '',
  });
  
  const [statusFilter, setStatusFilter] = useState<FiltroStatus>('ativo');
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
      const pausado = c.status === 'ativo' && estadoPausa(c) === 'pausado';
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'pausado' ? pausado : statusFilter === 'ativo' ? c.status === 'ativo' && !pausado : c.status === statusFilter);
      const matchesSearch = !searchTerm || 
        c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [contratos, statusFilter, searchTerm]);

  // Ordenação (select da barra de filtros)
  const [ordem, setOrdem] = useState<'valor' | 'proxima' | 'cliente' | 'inicio'>('valor');
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const sortedContratos = useMemo(() => {
    const lista = [...filteredContratos];
    if (ordem === 'cliente') return lista.sort((a, b) => (a.cliente?.nome || '').localeCompare(b.cliente?.nome || '', 'pt-BR'));
    if (ordem === 'inicio') return lista.sort((a, b) => (b.data_inicio || '').localeCompare(a.data_inicio || ''));
    if (ordem === 'proxima') return lista.sort((a, b) => (proximaCobranca(a) || '9999').localeCompare(proximaCobranca(b) || '9999'));
    return lista.sort((a, b) => getValorMensalEquivalente(Number(b.valor), b.recorrencia) - getValorMensalEquivalente(Number(a.valor), a.recorrencia));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredContratos, ordem, cobrancas]);

  // Resumo (sobre todos os contratos, não só o filtro): MRR pela vigência real.
  const resumo = useMemo(() => {
    const vigentes = contratos.filter(c => isContratoAtivoHoje(c as never));
    // MRR = soma do valor MENSAL EQUIVALENTE (quinzenal conta 2×, trimestral ÷3, etc.).
    const mrr = vigentes.reduce((sum, c) => sum + getValorMensalEquivalente(Number(c.valor), c.recorrencia), 0);
    const semCobranca = vigentes.filter((c) => c.recorrencia !== 'unico'
      && !(c as { asaas_subscription_id?: string | null }).asaas_subscription_id && !byContrato.has(c.id)).length;
    return { mrr, ativos: vigentes.length, semCobranca };
  }, [contratos, byContrato]);
  const contagem = useMemo(() => {
    const out: Record<FiltroStatus, number> = { ativo: 0, pausado: 0, encerrado: 0, cancelado: 0, all: contratos.length };
    for (const c of contratos) {
      if (c.status === 'ativo') { if (estadoPausa(c) === 'pausado') out.pausado++; else out.ativo++; }
      else if (c.status === 'encerrado') out.encerrado++;
      else if (c.status === 'cancelado') out.cancelado++;
    }
    return out;
  }, [contratos]);

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

  // Exporta a lista filtrada (botão do cabeçalho)
  const handleExportLista = () => {
    exportContratos(sortedContratos.map(c => ({
      numero_contrato: c.id.slice(0, 8),
      cliente: c.cliente?.nome || '-',
      tipo: c.recorrencia,
      valor_mensal: Number(c.valor),
      data_inicio: c.data_inicio,
      status: c.status,
    })));
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

  // ⋯ → Reajustar valor: abre a edição já com o formulário de reajuste aberto
  const abrirReajuste = (contrato: typeof contratos[0]) => {
    handleEdit(contrato);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    setAditivoData({ valor_novo: '', data_vigencia: nextMonth.toISOString().split('T')[0], motivo: '' });
    setShowAditivoForm(true);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    <main className="container space-y-5 py-4 md:py-6" onClick={() => setMenuAberto(null)}>
        <PageHeader eyebrow="Gestão · Recorrência" title="Contratos">
          <button type="button" onClick={() => sincronizarCobrancas()} disabled={cobrLoading} aria-label="Sincronizar cobranças (Asaas)" title="Sincronizar cobranças (Asaas)" className={btn.icon}>
            <RefreshCw className={cn('h-4 w-4', cobrLoading && 'animate-spin')} />
          </button>
          <button type="button" onClick={() => setImportDialogOpen(true)} aria-label="Importar contrato (PDF)" title="Importar contrato (PDF)" className={btn.icon}>
            <Upload className="h-4 w-4" />
          </button>
          <button type="button" onClick={handleExportLista} aria-label="Exportar lista" title="Exportar lista (CSV)" className={btn.icon}>
            <Download className="h-4 w-4" />
          </button>
          <button type="button" onClick={handleNew} className={btn.primary} aria-label="Novo Contrato">
            <Plus className="h-4 w-4" /><span className="sm:hidden">Novo</span><span className="hidden sm:inline">Novo contrato</span>
          </button>
        </PageHeader>

        {/* Resumo numa faixa só */}
        <div className="grid grid-cols-3 items-center gap-x-4 gap-y-3 rounded-[22px] border border-border bg-surface px-5 py-4 md:flex md:flex-wrap md:gap-x-8">
          <div className="col-span-3">
            <p className="text-[12px] text-foreground-muted">Receita recorrente (MRR)</p>
            <p className="font-heading text-[28px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{formatCurrency(resumo.mrr)}<span className="ml-1 text-[13px] font-normal text-foreground-muted">/mês</span></p>
          </div>
          <div className="h-10 w-px bg-border max-sm:hidden" />
          <div><p className="text-[12px] text-foreground-muted">Por ano (ARR)</p><p className="text-[15px] font-semibold tabular-nums text-foreground md:text-[17px]">{formatCurrency(resumo.mrr * 12)}</p></div>
          <div><p className="text-[12px] text-foreground-muted">Contratos ativos</p><p className="text-[15px] font-semibold tabular-nums text-foreground md:text-[17px]">{resumo.ativos}</p></div>
          <div><p className="text-[12px] text-foreground-muted">Ticket médio</p><p className="text-[15px] font-semibold tabular-nums text-foreground md:text-[17px]">{formatCurrency(resumo.mrr / Math.max(1, resumo.ativos))}</p></div>
          {resumo.semCobranca > 0 && (
            <div className="col-span-3 flex w-fit items-center gap-2 rounded-full bg-warning-bg px-3 py-1.5 text-[12.5px] text-warning-fg md:ml-auto">
              <BellRing className="h-3.5 w-3.5" /> {resumo.semCobranca} {resumo.semCobranca === 1 ? 'ativo sem cobrança' : 'ativos sem cobrança'} no Asaas
            </div>
          )}
        </div>

        {/* Contratos duplicados inflando o MRR */}
        {duplicateGroups.length > 0 && (
          <section className="rounded-[22px] border border-warning-fg/25 bg-warning-bg/40 p-4 md:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning-bg text-warning-fg"><AlertTriangle className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground">
                  {duplicateGroups.length === 1 ? '1 possível contrato duplicado' : `${duplicateGroups.length} possíveis contratos duplicados`} inflando o MRR
                </p>
                <p className="mt-0.5 text-[12.5px] text-foreground-muted">Mescle para manter apenas um contrato vigente por serviço/cliente. Os demais serão encerrados.</p>
              </div>
            </div>
            <div className="mt-2">
              {duplicateGroups.map((group, idx) => (
                <div key={`${group.cliente_id}-${idx}`} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-b-0">
                  <InitialsAvatar nome={group.cliente_nome} className="rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-foreground">{group.cliente_nome}</div>
                    <div className="truncate text-[12px] text-foreground-muted">{group.contratos.map(c => `${c.descricao} (${formatCurrency(Number(c.valor))})`).join(' • ')}</div>
                  </div>
                  <button type="button" onClick={() => openMergeDialog(group)} className={btn.mini}>Resolver</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" role="group" aria-label="Filtrar por status">
            {FILTROS_STATUS.map(([v, r]) => (
              <button key={v} type="button" onClick={() => setStatusFilter(v)} aria-pressed={statusFilter === v}
                className={cn('no-touch-min inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px]',
                  statusFilter === v ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground-muted hover:text-foreground')}>
                {r}<span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', statusFilter === v ? 'bg-background/20' : 'bg-surface-2')}>{contagem[v]}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <label className="flex h-9 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3.5 sm:w-72 sm:flex-none">
              <Search className="h-4 w-4 text-foreground-muted" />
              <input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar cliente ou serviço" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-foreground-muted" />
            </label>
            <div className="relative">
              <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} aria-label="Ordenar" className="h-9 appearance-none rounded-full border border-border bg-surface pl-8 pr-8 text-[13px] text-foreground outline-none">
                <option value="valor">Maior valor</option><option value="proxima">Próxima cobrança</option><option value="cliente">Cliente (A–Z)</option><option value="inicio">Mais recentes</option>
              </select>
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="rounded-[24px] border border-border bg-surface [&>div:last-child]:rounded-b-[24px]">
          <div className="hidden grid-cols-[28px_minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_130px_40px] items-center gap-4 border-b border-border px-5 py-2.5 text-[11.5px] uppercase tracking-[0.06em] text-foreground-muted md:grid">
            <button type="button" onClick={toggleSelectAll} aria-label="Selecionar todos"
              className={cn('grid h-5 w-5 place-items-center rounded-md border transition-colors', isAllSelected ? 'border-primary bg-primary text-primary-foreground' : isSomeSelected ? 'border-primary bg-primary/40 text-primary-foreground' : 'border-border-strong')}>
              {(isAllSelected || isSomeSelected) && <Check className="h-3.5 w-3.5" />}
            </button>
            <span>Cliente e serviço</span><span>Recorrência</span><span>Cobrança</span><span className="text-right">Valor</span><span />
          </div>
          {isLoading ? (
            <div className="p-4 md:p-5"><SkeletonTable rows={5} /></div>
          ) : sortedContratos.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-[15px] text-foreground">{contratos.length ? 'Nenhum contrato com esses filtros.' : 'Nenhum contrato ainda.'}</p>
              <p className="mt-1 text-[13px] text-foreground-muted">Crie um contrato para acompanhar seus acordos com clientes.</p>
              <button type="button" onClick={handleNew} className={cn(btn.primary, 'mt-4')}><Plus className="h-4 w-4" /> Novo contrato</button>
            </div>
          ) : sortedContratos.map((contrato) => {
            const marcado = isSelected(contrato.id);
            const pausado = contrato.status === 'ativo' && estadoPausa(contrato) === 'pausado';
            const st = pausado ? 'pausado' : contrato.status;
            const prox = proximaCobranca(contrato);
            const cob = cobrancaDoContrato(contrato.id);
            const mensalEq = getValorMensalEquivalente(Number(contrato.valor), contrato.recorrencia);
            const nomeCli = contrato.cliente?.nome || '-';
            return (
              <div key={contrato.id}
                className={cn('group relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-surface-2/50 md:grid-cols-[28px_minmax(0,2.2fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_130px_40px] md:gap-4 md:px-5',
                  marcado && 'bg-primary/5')}>
                <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(contrato.id); }} aria-label={`Selecionar ${contrato.descricao}`}
                  className={cn('hidden h-5 w-5 place-items-center rounded-md border transition-colors md:grid', marcado ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong md:opacity-0 md:group-hover:opacity-100', selectedIds.size > 0 && 'md:opacity-100')}>
                  {marcado && <Check className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => handleEdit(contrato)} className="flex min-w-0 items-center gap-3 text-left">
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold', corAvatar(nomeCli))}>{iniciais(nomeCli)}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold text-foreground">{nomeCli}</span>
                      {st !== 'ativo' && <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10.5px]', ST_CLS[st] || 'bg-surface-2 text-foreground-muted')}>{ST_LABEL[st] || st}</span>}</span>
                    <span className="block truncate text-[12.5px] text-foreground-muted">{contrato.descricao}</span>
                  </span>
                </button>
                <div className="col-span-3 row-start-2 flex flex-wrap items-center gap-x-2 pl-[52px] text-[12.5px] text-foreground-muted md:col-span-1 md:row-start-auto md:block md:pl-0">
                  <span className="text-foreground first-letter:uppercase md:block">{REC_LABEL[contrato.recorrencia] || contrato.recorrencia}</span><span className="md:hidden">·</span>
                  <span className="md:block">{contrato.recorrencia !== 'unico' && contrato.dia_vencimento ? `vence dia ${contrato.dia_vencimento} · ` : ''}desde {formatDate(contrato.data_inicio).slice(3)}</span>
                </div>
                <div className="col-span-3 row-start-3 pl-[52px] md:col-span-1 md:row-start-auto md:pl-0" onClick={(e) => e.stopPropagation()}>
                  <ContratoCobrancaCell
                    contratoId={contrato.id}
                    cobranca={cob}
                    busy={cobrBusyId === contrato.id || cobrBusyId === cob?.id}
                    contas={contasRecebimento}
                    clienteNome={contrato.cliente?.nome || ''}
                    contratoDescricao={contrato.descricao}
                    contratoValor={contrato.valor}
                    onCobrar={(forma, contaId, extra) => criarCobranca(contrato.id, forma, contaId, extra)}
                    onListarAssinaturas={() => listarAssinaturas(contrato.cliente_id)}
                    onVincular={async (subId, contaId) => { await vincularAssinatura(contrato.id, subId, contaId); refetchContratos(); }}
                    onDesvincular={() => setDesvincularAlvo({ id: contrato.id, nome: contrato.cliente?.nome || contrato.descricao || 'contrato' })}
                    onCancelar={() => { if (cob) setCancelandoCob({ cob, nome: contrato.cliente?.nome || '' }); }}
                    onSincronizar={() => sincronizarCobrancas(contrato.id)}
                    onReceberManual={() => { if (cob) receberManualCobranca(cob.id); }}
                    onWhatsapp={() => openWhatsapp(cob)}
                    grupoQtd={cob ? linhasDaFatura(cob).length : 1}
                  />
                  {prox && <span className="mt-0.5 block text-[12px] text-foreground-muted">próxima em {formatDate(prox)}</span>}
                </div>
                <div className="col-start-2 row-start-1 text-right md:col-start-auto md:row-start-auto">
                  <span className="block font-heading text-[16px] font-semibold tabular-nums text-foreground">{formatCurrency(Number(contrato.valor))}</span>
                  <span className="block text-[11.5px] text-foreground-muted">{contrato.recorrencia === 'mensal' ? 'por mês' : contrato.recorrencia === 'unico' ? 'valor único' : `${formatCurrency(mensalEq)}/mês`}</span>
                </div>
                <div className="relative col-start-3 row-start-1 md:col-start-auto md:row-start-auto" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => setMenuAberto(menuAberto === contrato.id ? null : contrato.id)} aria-label="Mais ações" className="grid h-9 w-9 place-items-center rounded-full text-foreground-muted hover:bg-surface-2 hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
                  {menuAberto === contrato.id && (
                    <div className="absolute right-0 top-10 z-30 w-56 rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
                      <button type="button" onClick={() => { setMenuAberto(null); handleEdit(contrato); }} className={MENU_ITEM}><Pencil className="h-4 w-4" />Editar</button>
                      <button type="button" onClick={() => { setMenuAberto(null); abrirReajuste(contrato); }} className={MENU_ITEM}><FileSignature className="h-4 w-4" />Reajustar valor</button>
                      {contrato.status === 'ativo' && contrato.recorrencia !== 'unico' && (
                        <button type="button" onClick={() => { setMenuAberto(null); handleEdit(contrato); }} className={MENU_ITEM}><Pause className="h-4 w-4" />{pausado ? 'Reativar / pausa' : 'Pausar'}</button>
                      )}
                      <button type="button" onClick={() => { setMenuAberto(null); navigate('/cobrancas'); }} className={MENU_ITEM}><CalendarDays className="h-4 w-4" />Ver cobranças</button>
                      <div className="my-1 h-px bg-border" />
                      <button type="button" onClick={() => { setMenuAberto(null); setDeletingId(contrato.id); setDeleteDialogOpen(true); }} className={cn(MENU_ITEM, 'text-danger-fg hover:bg-danger-bg')}><Trash2 className="h-4 w-4" />Excluir</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Create/Edit Modal */}
        <Sheet open={modalOpen} onOpenChange={setModalOpen}>
          <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[940px]')}>
            <form onSubmit={handleSubmit} className="flex max-h-[92dvh] flex-col md:max-h-[88dvh]">
              <ModalHeader
                eyebrow={editingContrato ? 'Contrato' : 'Cadastro'}
                title={editingContrato ? (clientes.find((c) => c.id === formData.cliente_id)?.nome || 'Editar contrato') : 'Novo contrato'}
                onClose={() => setModalOpen(false)}
              />
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-3 p-4 md:p-5">
                  <Secao n={1} title="Cliente e serviço" extra={
                    <div className="flex items-center gap-3">
                      {formData.cliente_id && !novoClienteOpen && (
                        <button type="button" onClick={() => setEditarClienteOpen(true)} className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
                          <Pencil className="h-3 w-3" /> Editar cadastro
                        </button>
                      )}
                      <button type="button" onClick={() => setNovoClienteOpen(v => !v)} className="text-[12px] text-primary hover:underline">
                        {novoClienteOpen ? 'Cancelar' : '+ Novo cliente'}
                      </button>
                    </div>
                  }>
                    <Campo label="Cliente">
                      {novoClienteOpen ? (
                        <div className="flex gap-2">
                          <Input autoFocus value={novoClienteNome} onChange={(e) => setNovoClienteNome(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCriarClienteInline(); } }}
                            placeholder="Nome do novo cliente" />
                          <button type="button" onClick={handleCriarClienteInline} disabled={criandoCliente || !novoClienteNome.trim()} className={btn.primary}>
                            {criandoCliente ? 'Criando…' : 'Criar'}
                          </button>
                        </div>
                      ) : (
                        <Select value={formData.cliente_id} onValueChange={(value) => setFormData(prev => ({ ...prev, cliente_id: value }))}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                          <SelectContent>
                            {activeClientes.map(cliente => <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </Campo>
                    <Campo label="O que você entrega">
                      <Input id="descricao" value={formData.descricao} onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))} placeholder="Ex.: Gestão de redes sociais" required />
                    </Campo>
                  </Secao>

                  <Secao n={2} title="Valor e recorrência">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Campo label="Valor">
                        <div className="flex h-10 items-center rounded-xl border border-input bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-ring">
                          <span className="mr-1 text-foreground-muted">R$</span>
                          <input id="valor" type="number" step="0.01" min="0" value={formData.valor} onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))} placeholder="0,00" required className="min-w-0 flex-1 bg-transparent font-semibold tabular-nums outline-none" />
                        </div>
                      </Campo>
                      {formData.recorrencia !== 'unico' ? (
                        <Campo label="Vence todo dia" hint="Se o mês não tiver esse dia, vence no último.">
                          <Input id="dia_vencimento" type="number" min="1" max="31" value={formData.dia_vencimento} onChange={(e) => setFormData(prev => ({ ...prev, dia_vencimento: e.target.value }))} placeholder="Ex: 10" required />
                        </Campo>
                      ) : (
                        <Campo label="Número de parcelas">
                          <Input id="num_parcelas" type="number" min="1" max="60" value={formData.num_parcelas} onChange={(e) => setFormData(prev => ({ ...prev, num_parcelas: e.target.value }))} />
                        </Campo>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Recorrência">
                      {RECORRENCIA_OPTIONS.map(option => (
                        <button key={option.value} type="button" onClick={() => setFormData(prev => ({ ...prev, recorrencia: option.value }))} aria-pressed={formData.recorrencia === option.value}
                          className={cn('no-touch-min h-9 rounded-full border px-3.5 text-[13px] transition-colors', formData.recorrencia === option.value ? 'border-foreground bg-foreground font-medium text-background' : 'border-border text-foreground-muted hover:text-foreground')}>
                          {REC_LABEL[option.value]}
                        </button>
                      ))}
                    </div>
                    {formData.recorrencia === 'unico' && parcelas.length > 0 && (
                      <div className="overflow-hidden rounded-2xl border border-border">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-[12px] text-foreground-muted"><th className="px-3 py-2">Parcela</th><th className="px-3 py-2">Vencimento</th><th className="px-3 py-2 text-right">Valor</th></tr></thead>
                          <tbody>
                            {parcelas.map((parcela, index) => (
                              <tr key={index} className="border-t border-border">
                                <td className="px-3 py-2 text-foreground-muted">{parcela.numero_parcela}/{parcelas.length}</td>
                                <td className="px-3 py-2">
                                  <Input type="date" value={parcela.data_vencimento} onChange={(e) => { const n = [...parcelas]; n[index] = { ...n[index], data_vencimento: e.target.value }; setParcelas(n); }} className="w-full" />
                                </td>
                                <td className="px-3 py-2">
                                  <Input type="number" step="0.01" value={parcela.valor} onChange={(e) => { const n = [...parcelas]; n[index] = { ...n[index], valor: parseFloat(e.target.value) || 0 }; setParcelas(n); }} className="w-24 text-right" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="border-t border-border bg-surface-2"><td colSpan={2} className="px-3 py-2.5 font-medium">Total</td><td className="px-3 py-2.5 text-right font-heading font-semibold tabular-nums">{formatCurrency(parcelas.reduce((sum, p) => sum + p.valor, 0))}</td></tr></tfoot>
                        </table>
                      </div>
                    )}
                  </Secao>

                  <Secao n={3} title="Vigência e status">
                    <div className="grid grid-cols-2 gap-3">
                      <DatePickerField label="Começa em *" value={formData.data_inicio} onChange={(d) => setFormData(prev => ({ ...prev, data_inicio: d }))} required />
                      <DatePickerField label="Termina em (opcional)" value={formData.data_fim} onChange={(d) => setFormData(prev => ({ ...prev, data_fim: d }))} />
                    </div>
                    <Segmented<'ativo' | 'encerrado' | 'cancelado'> value={formData.status} onChange={(s) => setFormData(prev => ({ ...prev, status: s }))} opts={[['ativo', 'Ativo'], ['encerrado', 'Encerrado'], ['cancelado', 'Cancelado']]} />
                    {formData.status !== 'ativo' && (
                      <div>
                        <DatePickerField label="Data de inativação" value={formData.data_inativacao} onChange={(d) => setFormData(prev => ({ ...prev, data_inativacao: d }))} />
                        <p className="mt-1 text-[11.5px] text-foreground-muted">Data efetiva de encerramento/cancelamento. Se não informada, será usada a data atual.</p>
                      </div>
                    )}
                    {(() => {
                      const atual = editingContratoId ? contratos.find(c => c.id === editingContratoId) : undefined;
                      if (!atual || atual.status !== 'ativo' || atual.recorrencia === 'unico') return null;
                      return <PausaContrato key={`${atual.id}-${atual.pausado_desde}-${atual.pausado_ate}`} contrato={atual} onChange={() => refetchContratos()} />;
                    })()}
                  </Secao>

                  {formData.recorrencia !== 'unico' && (
                    <Secao n={4} title="Cobrança">
                      {!editingContrato && (
                        <div className="rounded-2xl bg-surface-2/60 px-3.5 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span><span className="flex items-center gap-1.5 text-[14px] text-foreground"><Zap className="h-4 w-4 text-primary" />Cobrar todo mês pelo Asaas</span><span className="block text-[12px] text-foreground-muted">Cria a assinatura e lança a receita a receber · baixa automática</span></span>
                            <Switch checked={novoContratoCobranca} onCheckedChange={setNovoContratoCobranca} aria-label="Criar cobrança no Asaas" />
                          </div>
                          {novoContratoCobranca && (
                            <div className="mt-3 space-y-3 border-t border-border pt-3">
                              <Segmented<string> value={ncForma} onChange={setNcForma} opts={[['UNDEFINED', 'Cliente escolhe'], ['PIX', 'Pix'], ['BOLETO', 'Boleto'], ['CREDIT_CARD', 'Cartão']]} />
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <Campo label="Recebe na conta">
                                  <select value={ncConta} onChange={(e) => setNcConta(e.target.value)} className={campoCls}>
                                    <option value="">Defino depois</option>
                                    {contasRecebimento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                  </select>
                                </Campo>
                                <Campo label="Multa por atraso (%)"><Input type="number" step="0.01" min="0" value={ncMulta} onChange={(e) => setNcMulta(e.target.value)} placeholder="0" /></Campo>
                                <Campo label="Juros ao mês (%)"><Input type="number" step="0.01" min="0" value={ncJuros} onChange={(e) => setNcJuros(e.target.value)} placeholder="0" /></Campo>
                              </div>
                              <p className="text-[11.5px] leading-snug text-foreground-muted">Multa/juros só incidem se atrasar — juros é <b>ao mês</b> (proporcional aos dias). O juros/multa recebido entra como receita extra na baixa.</p>
                            </div>
                          )}
                        </div>
                      )}
                      <p className="pt-1 text-[12.5px] text-foreground-muted">Lembretes automáticos (WhatsApp da empresa e e-mail)</p>
                      <Segmented<'padrao' | 'off' | 'custom'> value={caModo} onChange={setCaModo} opts={[['padrao', 'Padrão'], ['off', 'Desligado'], ['custom', 'Personalizado']]} />
                      <p className="text-[11.5px] text-foreground-muted">
                        {caModo === 'padrao' ? 'Usa a regra global (Meu Perfil).' : caModo === 'off' ? 'Nunca dispara automático para este contrato.' : 'Define uma regra só para este contrato.'}
                      </p>
                      <div className="divide-y divide-border rounded-2xl border border-border">
                        {caModo === 'custom' && (
                          <>
                            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13.5px] text-foreground">Enviar X dias antes
                              <Input type="number" min="0" value={caAntes} onChange={(e) => setCaAntes(e.target.value)} placeholder="0" className="h-9 w-20 text-center" />
                            </div>
                            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13.5px] text-foreground">Enviar no dia<Switch checked={caNoDia} onCheckedChange={setCaNoDia} /></div>
                            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13.5px] text-foreground">Reenviar todo dia em atraso<Switch checked={caAtraso} onCheckedChange={setCaAtraso} /></div>
                          </>
                        )}
                        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13.5px] text-foreground">Exigir nota fiscal (PDF) para disparar<Switch checked={caExigirNf} onCheckedChange={setCaExigirNf} /></div>
                        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13.5px] text-foreground">No WhatsApp, enviar chave PIX (não o link Asaas)<Switch checked={caEnvioPix} onCheckedChange={setCaEnvioPix} /></div>
                      </div>
                      <p className="text-[11.5px] text-foreground-muted">Vale para as próximas cobranças geradas deste contrato. A chave PIX é a de Meu Perfil; a baixa é pelo "Identificar pagamento manual".</p>
                    </Secao>
                  )}

                  {editingContrato && (
                    <Secao n={formData.recorrencia !== 'unico' ? 5 : 4} title="Reajustes" extra={!showAditivoForm && (
                      <button type="button" onClick={() => {
                        const nextMonth = new Date();
                        nextMonth.setMonth(nextMonth.getMonth() + 1);
                        nextMonth.setDate(1);
                        setAditivoData({ valor_novo: '', data_vigencia: nextMonth.toISOString().split('T')[0], motivo: '' });
                        setShowAditivoForm(true);
                      }} className={btn.mini}><Plus className="mr-1 inline h-3 w-3" />Novo reajuste</button>
                    )}>
                      {showAditivoForm && (
                        <div className="space-y-3 rounded-2xl bg-surface-2/60 p-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[14px] font-medium text-foreground">Novo reajuste</span>
                            <button type="button" aria-label="Fechar novo reajuste" onClick={() => setShowAditivoForm(false)} className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface"><X className="h-3.5 w-3.5" /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Campo label="Novo valor *"><Input type="number" step="0.01" min="0" value={aditivoData.valor_novo} onChange={(e) => setAditivoData(prev => ({ ...prev, valor_novo: e.target.value }))} placeholder="0,00" /></Campo>
                            <DatePickerField label="Vigência a partir de *" value={aditivoData.data_vigencia} onChange={(d) => setAditivoData(prev => ({ ...prev, data_vigencia: d }))} />
                          </div>
                          <Campo label="Motivo"><Input value={aditivoData.motivo} onChange={(e) => setAditivoData(prev => ({ ...prev, motivo: e.target.value }))} placeholder="Ex: mais usuários + novo serviço" /></Campo>
                          <button type="button" onClick={handleSaveAditivo} disabled={isSaving || !aditivoData.valor_novo || !aditivoData.data_vigencia} className={cn(btn.primary, 'w-full')}>
                            {isSaving ? 'Salvando...' : 'Salvar reajuste'}
                          </button>
                        </div>
                      )}
                      {aditivosLoading ? (
                        <p className="text-[12.5px] text-foreground-muted">Carregando...</p>
                      ) : aditivos.length === 0 ? (
                        <p className="text-[12.5px] text-foreground-muted">Nenhum reajuste registrado.</p>
                      ) : (
                        <div className="divide-y divide-border rounded-2xl border border-border px-3.5">
                          {aditivos.map(aditivo => (
                            <div key={aditivo.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="tabular-nums text-foreground-muted line-through">{formatCurrency(Number(aditivo.valor_anterior))}</span>
                                  <span className="text-foreground">→</span>
                                  <span className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(Number(aditivo.valor_novo))}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[12px] text-foreground-muted">
                                  <span>A partir de {formatDate(aditivo.data_vigencia)}</span>
                                  {aditivo.motivo && <span className="truncate">• {aditivo.motivo}</span>}
                                </div>
                              </div>
                              <button type="button" aria-label="Excluir reajuste" onClick={() => deleteAditivo(aditivo.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-danger-fg hover:bg-danger-bg"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Secao>
                  )}
                </div>

                {/* Resumo ao vivo */}
                <aside className="border-t border-border bg-surface p-5 md:border-l md:border-t-0">
                  <div className="space-y-4 md:sticky md:top-0">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground-muted">Resumo</p>
                    <div>
                      <p className="font-heading text-[30px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{formatCurrency(parseFloat(formData.valor) || 0)}</p>
                      <p className="text-[13px] text-foreground-muted">{REC_RESUMO[formData.recorrencia]}</p>
                    </div>
                    <dl className="space-y-2.5 text-[13px]">
                      <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Cliente</dt><dd className="truncate text-right text-foreground">{clientes.find((c) => c.id === formData.cliente_id)?.nome || '—'}</dd></div>
                      {formData.recorrencia !== 'unico' && formData.dia_vencimento && (
                        <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Vence</dt><dd className="text-foreground">todo dia {formData.dia_vencimento}</dd></div>
                      )}
                      <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Entra no MRR</dt><dd className="font-semibold text-success-fg">{formData.recorrencia === 'unico' ? '—' : `+${formatCurrency(getValorMensalEquivalente(parseFloat(formData.valor) || 0, formData.recorrencia))}`}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Status</dt><dd className="text-foreground">{ST_LABEL[formData.status]}</dd></div>
                      {formData.recorrencia !== 'unico' && (
                        <div className="flex justify-between gap-2"><dt className="text-foreground-muted">Lembretes</dt><dd className="text-foreground">{caModo === 'off' ? 'desligados' : caModo === 'custom' ? 'personalizados' : 'regra padrão'}</dd></div>
                      )}
                    </dl>
                    <p className="rounded-2xl bg-primary/5 p-3 text-[12px] leading-relaxed text-foreground-muted">
                      {formData.recorrencia === 'unico' ? 'As parcelas viram receitas a receber no financeiro ao salvar.' : 'As receitas dos próximos 12 meses entram no financeiro ao salvar.'}
                    </p>
                  </div>
                </aside>
              </div>
              <ModalFooter left={editingContrato ? (
                <button type="button" onClick={() => { if (editingContrato) { setModalOpen(false); setDeletingId(editingContrato.id); setDeleteDialogOpen(true); } }} className={btn.danger}><Trash2 className="h-4 w-4" /> Excluir</button>
              ) : undefined}>
                <button type="button" onClick={() => setModalOpen(false)} className={btn.outline}>Cancelar</button>
                <button type="submit" disabled={isSaving} className={btn.primary}>
                  {isSaving ? 'Salvando…' : editingContrato ? <><span className="md:hidden">Salvar</span><span className="max-md:hidden">Salvar alterações</span></> : 'Criar contrato'}
                </button>
              </ModalFooter>
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

        <CancelarCobrancaDialog
          cobranca={cancelandoCob?.cob ?? null}
          clienteNome={cancelandoCob?.nome}
          onOpenChange={(o) => { if (!o) setCancelandoCob(null); }}
          onCancelarSoEsta={cancelarSoEstaCobranca}
          onCancelar={cancelarCobranca}
          onExcluir={excluirCobranca}
          onRemoverDoHistorico={removerCobrancaDoHistorico}
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
          <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
            <ModalShell>
              <ModalHeader eyebrow="Cobrança" title="Enviar por WhatsApp" onClose={() => setWhatsappOpen(false)} />
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
                <Campo label="WhatsApp do cliente" hint="Vem do cadastro do cliente. Enviamos com DDI+DDD, sem o nono dígito.">
                  <Input type="tel" inputMode="tel" value={whatsappTel} onChange={(e) => setWhatsappTel(e.target.value)} placeholder="(65) 99902-0102" />
                </Campo>
                <Campo label="Mensagem" hint="Aceita *negrito*, _itálico_ e quebra de linha. Edite à vontade — o padrão vem de Meu Perfil.">
                  <Textarea value={whatsappText} onChange={(e) => setWhatsappText(e.target.value)} rows={10} className="font-mono text-[13px] leading-relaxed" />
                </Campo>
                {whatsappNotas.length ? (
                  <InlineNotice tone="neutral" icon={<FileText className="text-primary" />}>
                    <span className="block">Vai anexar {whatsappNotas.length > 1 ? `${whatsappNotas.length} notas fiscais:` : 'a nota fiscal:'}</span>
                    {whatsappNotas.map((n) => <span key={n.path} className="block truncate text-foreground-muted">{n.nome}</span>)}
                  </InlineNotice>
                ) : whatsappBloqueado ? (
                  <InlineNotice tone="warning" icon={<FileText />}>Esta cobrança exige nota fiscal anexada. Anexe na tela de Cobranças.</InlineNotice>
                ) : null}
              </div>
              <ModalFooter>
                <button type="button" onClick={() => setWhatsappOpen(false)} className={btn.outline}>Cancelar</button>
                <button type="button" onClick={handleEnviarWhatsapp} disabled={whatsappSending || whatsappBloqueado || !whatsappTel.trim() || !whatsappText.trim()} className={btn.primary}>
                  {whatsappSending && <Loader2 className="h-4 w-4 animate-spin" />}Enviar
                </button>
              </ModalFooter>
            </ModalShell>
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

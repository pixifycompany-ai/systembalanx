import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpDown, Building2, Check, ChevronDown, FileText, LayoutGrid, List, Mail, MessageCircle, Pencil,
  Phone, Plus, Search, Sparkles, Trash2, UserRound, X,
} from 'lucide-react';
import { useActionParam } from '@/hooks/useActionParam';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MultiSelectBar } from '@/components/shared/MultiSelectBar';
import { EMPRESA_FONTE_OPTIONS, type EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';
import { ClienteAvatar } from '@/components/clientes/ClienteAvatar';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PageHeader, Segmented, Secao, Campo, Bloco, ModalHeader, ModalFooter, ModalShell } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';
import { formatCurrency, formatPhone, formatCPFCNPJ, maskCpfCnpj, onlyDigits } from '@/utils/formatters';
import { exportClientes } from '@/utils/exportCSV';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useClientes, type ClienteDB, type ClienteFormData } from '@/hooks/useClientes';
import { useClientesResumo, type ClienteNumeros } from '@/hooks/useClientesResumo';
import { cn } from '@/lib/utils';

const FORM_VAZIO: ClienteFormData = {
  nome: '', email: '', telefone: '', cpf_cnpj: '', tipo: 'PJ', endereco: '', status: 'ativo', empresa_fonte: 'PIXIFY', canal_cobranca: 'whatsapp',
};
const corMarca = (m: string) => `hsl(var(--brand-${m.toLowerCase()}))`;
const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const RECORRENCIA: Record<string, string> = { mensal: 'mensal', trimestral: 'trimestral', semestral: 'semestral', anual: 'anual', unico: 'único', semanal: 'semanal', quinzenal: 'quinzenal' };
const CANAL: Record<string, string> = { whatsapp: 'WhatsApp', email: 'e-mail', ambos: 'WhatsApp e e-mail' };

function MarcaChip({ m }: { m?: EmpresaFonte | null }) {
  if (!m) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium tracking-[0.04em] text-foreground-muted">
      <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: corMarca(m) }} />{m}
    </span>
  );
}

/* ---------- Ficha do cliente ---------- */
function Ficha({ c, n, fechar, editar, excluir }: { c: ClienteDB; n: ClienteNumeros; fechar: () => void; editar: () => void; excluir: () => void }) {
  const navigate = useNavigate();
  const fone = c.telefone ? onlyDigits(c.telefone) : '';
  const wa = fone ? `https://wa.me/${fone.length <= 11 ? `55${fone}` : fone}` : '';
  return (
    <ModalShell>
      <div className="flex items-start gap-3 border-b border-border bg-surface px-5 py-4 md:px-6">
        <ClienteAvatar nome={c.nome} className="h-12 w-12 rounded-full text-[15px]" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-foreground-muted">
            {c.tipo === 'PJ' ? 'Empresa' : 'Pessoa física'}{c.cpf_cnpj && <> · <span className="tabular-nums">{formatCPFCNPJ(c.cpf_cnpj)}</span></>} <MarcaChip m={c.empresa_fonte} />
            {c.status !== 'ativo' && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px]">Inativo</span>}
          </p>
          <h2 className="truncate font-heading text-[24px] font-light tracking-[-0.02em] text-foreground">{c.nome}</h2>
        </div>
        <button type="button" onClick={editar} className="hidden h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] text-foreground hover:bg-surface-2 sm:inline-flex"><Pencil className="h-3.5 w-3.5" /> Editar</button>
        <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground-muted hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {([['MRR', n.mrr, 'text-foreground'], ['Recebido no ano', n.recebidoAno, 'text-success-fg'], ['Em aberto', n.aberto, 'text-foreground'], ['Atrasado', n.atrasado, n.atrasado ? 'text-danger-fg' : 'text-foreground-muted']] as const).map(([r, v, k]) => (
            <div key={r} className="rounded-2xl border border-border bg-surface p-3">
              <p className="text-[12px] text-foreground-muted">{r}</p>
              <p className={cn('font-heading text-[18px] font-semibold tabular-nums', k)}>{formatCurrency(v)}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <Bloco title={`Contratos ativos · ${n.contratos.length}`} extra={<button type="button" onClick={() => navigate('/contratos?action=novo')} className="text-[12.5px] text-primary hover:underline">+ Novo contrato</button>}>
              {n.contratos.length ? n.contratos.map((k) => (
                <div key={k.id} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground-muted"><FileText className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] text-foreground">{k.descricao}</span><span className="block text-[12px] text-foreground-muted">{RECORRENCIA[k.recorrencia] ?? k.recorrencia}{k.dia_vencimento ? ` · vence dia ${k.dia_vencimento}` : ''}</span></span>
                  <span className="text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(k.valor)}</span>
                </div>
              )) : <p className="text-[13px] text-foreground-muted">Nenhum contrato ativo.</p>}
            </Bloco>
            <Bloco title="Recebimentos recentes" extra={<button type="button" onClick={() => navigate('/cobrancas?action=novo')} className="text-[12.5px] text-primary hover:underline">+ Nova cobrança</button>}>
              {n.recentes.length ? n.recentes.map((r) => {
                const st = r.status === 'recebido' ? ['Recebido', 'bg-success-bg text-success-fg'] : r.status === 'atrasado' ? ['Atrasado', 'bg-danger-bg text-danger-fg'] : ['Em aberto', 'bg-info-bg text-info-fg'];
                return (
                  <div key={r.id} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
                    <span className="w-11 shrink-0 text-[12.5px] tabular-nums text-foreground-muted">{dataBR(r.data_vencimento)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">{r.descricao}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px]', st[1])}>{st[0]}</span>
                    <span className="w-24 text-right text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(r.valor)}</span>
                  </div>
                );
              }) : <p className="text-[13px] text-foreground-muted">Nenhum lançamento deste cliente ainda.</p>}
            </Bloco>
          </div>
          <div className="space-y-3">
            <Bloco title="Contato">
              {([[<MessageCircle key="w" className="h-4 w-4" />, c.telefone ? formatPhone(c.telefone) : '', 'WhatsApp', wa], [<Mail key="m" className="h-4 w-4" />, c.email || '', 'E-mail', c.email ? `mailto:${c.email}` : '']] as const).map(([ic, v, r, href]) => (
                <div key={r} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground-muted">{ic}</span>
                  <span className="min-w-0 flex-1"><span className={cn('block truncate text-[13.5px]', v ? 'text-foreground' : 'text-foreground-subtle')}>{v || 'não cadastrado'}</span><span className="block text-[12px] text-foreground-muted">{r}</span></span>
                  {v ? <a href={href} target="_blank" rel="noreferrer" className={btn.mini + ' inline-flex items-center'}>Abrir</a> : <button type="button" onClick={editar} className={cn(btn.mini, 'text-primary')}>Adicionar</button>}
                </div>
              ))}
              {c.endereco && <p className="mt-2 border-t border-border pt-2.5 text-[12.5px] text-foreground-muted">{c.endereco}</p>}
            </Bloco>
            <Bloco title="Cobrança">
              <p className="text-[13.5px] text-foreground">Recebe por <b className="font-semibold">{CANAL[c.canal_cobranca || 'whatsapp']}</b></p>
              <p className="text-[12px] text-foreground-muted">{n.ultimoPagamento ? `Último pagamento em ${dataBR(n.ultimoPagamento)}/${n.ultimoPagamento.slice(0, 4)}` : 'Ainda sem pagamentos'}</p>
              {!c.telefone && !c.email && <p className="mt-2 rounded-xl bg-warning-bg px-3 py-2 text-[12px] text-warning-fg">Sem WhatsApp nem e-mail: as cobranças automáticas não saem.</p>}
            </Bloco>
          </div>
        </div>
      </div>
      <ModalFooter left={<button type="button" onClick={excluir} className={btn.danger}><Trash2 className="h-4 w-4" />Excluir</button>}>
        <button type="button" onClick={fechar} className={btn.outline}>Fechar</button>
        <button type="button" onClick={editar} className={btn.primary}><Pencil className="h-4 w-4" />Editar</button>
      </ModalFooter>
    </ModalShell>
  );
}

/* ---------- Criar / editar ---------- */
function FormCliente({ editando, form, setForm, onSubmit, fechar, isSaving, excluir }: {
  editando: boolean; form: ClienteFormData; setForm: React.Dispatch<React.SetStateAction<ClienteFormData>>;
  onSubmit: (e: React.FormEvent) => void; fechar: () => void; isSaving: boolean; excluir?: () => void;
}) {
  const [busca, setBusca] = useState<'idle' | 'buscando' | 'ok' | 'erro'>('idle');
  const doc = onlyDigits(form.cpf_cnpj || '');

  // Com o CNPJ, busca os dados públicos da Receita (BrasilAPI) e completa só o que estiver vazio.
  const buscarCnpj = async () => {
    if (doc.length !== 14) return;
    setBusca('buscando');
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`);
      if (!r.ok) throw new Error('não encontrado');
      const d = await r.json();
      const endereco = [
        [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' '), d.numero, d.complemento, d.bairro,
        d.municipio && d.uf ? `${d.municipio}/${d.uf}` : d.municipio, d.cep,
      ].filter((x: unknown) => x && String(x).trim()).join(', ');
      setForm((p) => ({
        ...p,
        nome: p.nome || d.nome_fantasia || d.razao_social || '',
        email: p.email || (d.email ? String(d.email).toLowerCase() : ''),
        telefone: p.telefone || onlyDigits(d.ddd_telefone_1 || '').slice(0, 11),
        endereco: p.endereco || endereco,
      }));
      setBusca('ok');
    } catch {
      setBusca('erro');
    }
  };

  return (
    <form onSubmit={onSubmit} className="contents">
      <ModalShell>
        <ModalHeader eyebrow="Cadastro" title={editando ? 'Editar cliente' : 'Novo cliente'} onClose={fechar} />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
          <Secao n={1} title="Identificação">
            <Segmented<'PJ' | 'PF'> value={form.tipo} onChange={(v) => { setForm((p) => ({ ...p, tipo: v, cpf_cnpj: onlyDigits(p.cpf_cnpj || '').slice(0, v === 'PJ' ? 14 : 11) })); setBusca('idle'); }} opts={[['PJ', 'Empresa (CNPJ)'], ['PF', 'Pessoa física (CPF)']]} />
            <Campo label={form.tipo === 'PJ' ? 'CNPJ' : 'CPF'} hint={form.tipo === 'PJ' ? 'Com o CNPJ, o BALANX busca nome, endereço e contato na Receita.' : undefined}>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  value={maskCpfCnpj(form.cpf_cnpj || '', form.tipo)}
                  onChange={(e) => { setForm((p) => ({ ...p, cpf_cnpj: onlyDigits(e.target.value).slice(0, p.tipo === 'PJ' ? 14 : 11) })); setBusca('idle'); }}
                  placeholder={form.tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  maxLength={form.tipo === 'PJ' ? 18 : 14}
                />
                {form.tipo === 'PJ' && (
                  <button type="button" onClick={buscarCnpj} disabled={doc.length !== 14 || busca === 'buscando'} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-40">
                    <Sparkles className="h-3.5 w-3.5" />{busca === 'buscando' ? 'Buscando…' : 'Buscar dados'}
                  </button>
                )}
              </div>
            </Campo>
            {busca === 'ok' && <p className="flex items-center gap-1.5 rounded-xl bg-success-bg px-3 py-2 text-[12.5px] text-success-fg"><Check className="h-3.5 w-3.5" /> Dados da Receita preenchidos nos campos vazios.</p>}
            {busca === 'erro' && <p className="rounded-xl bg-warning-bg px-3 py-2 text-[12.5px] text-warning-fg">Não achei esse CNPJ na Receita agora. Preencha à mão.</p>}
            <Campo label="Nome que aparece nas cobranças">
              <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome fantasia ou nome da pessoa" required />
            </Campo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Marca (empresa-fonte)">
                <select value={form.empresa_fonte || 'PIXIFY'} onChange={(e) => setForm((p) => ({ ...p, empresa_fonte: e.target.value as EmpresaFonte }))} className={campoCls}>
                  {EMPRESA_FONTE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Campo>
              <Campo label="Situação">
                <Segmented<'ativo' | 'inativo'> value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))} opts={[['ativo', 'Ativo'], ['inativo', 'Inativo']]} />
              </Campo>
            </div>
          </Secao>
          <Secao n={2} title="Contato">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="WhatsApp">
                <Input type="tel" inputMode="tel" autoComplete="tel" value={form.telefone || ''} maxLength={11}
                  onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value.replace(/\D/g, '') }))} placeholder="DDD + número" />
              </Campo>
              <Campo label="E-mail">
                <Input type="email" value={form.email || ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="financeiro@empresa.com.br" />
              </Campo>
            </div>
            <Campo label="Endereço">
              <Input value={form.endereco || ''} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} placeholder="Rua, número, cidade - UF" />
            </Campo>
          </Secao>
          <Secao n={3} title="Cobrança">
            <Campo label="Enviar as cobranças por">
              <Segmented<'whatsapp' | 'email' | 'ambos'> value={form.canal_cobranca || 'whatsapp'} onChange={(v) => setForm((p) => ({ ...p, canal_cobranca: v }))} opts={[['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['ambos', 'Os dois']]} />
            </Campo>
          </Secao>
        </div>
        <ModalFooter left={editando && excluir ? <button type="button" onClick={excluir} className={btn.danger}><Trash2 className="h-4 w-4" />Excluir</button> : undefined}>
          <button type="button" onClick={fechar} className={btn.outline}>Cancelar</button>
          <button type="submit" disabled={isSaving || !form.nome} className={btn.primary}>{isSaving ? 'Salvando…' : editando ? 'Salvar' : 'Cadastrar cliente'}</button>
        </ModalFooter>
      </ModalShell>
    </form>
  );
}

export default function Clientes() {
  const { clientes, isLoading, createCliente, updateCliente, deleteCliente, deleteMultipleClientes } = useClientes();
  const { numeros } = useClientesResumo();

  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [marca, setMarca] = useState<EmpresaFonte | 'todas'>('todas');
  const [ordem, setOrdem] = useState<'mrr' | 'atraso' | 'nome'>('nome');
  const [vista, setVista] = useState<'cards' | 'lista'>('cards');

  const [ficha, setFicha] = useState<ClienteDB | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClienteFormData>(FORM_VAZIO);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleNew = () => { setEditingId(null); setFormData(FORM_VAZIO); setModalOpen(true); };
  useActionParam('novo', () => handleNew());

  const handleEdit = (c: ClienteDB) => {
    setEditingId(c.id);
    setFormData({
      nome: c.nome, email: c.email || '', telefone: c.telefone || '', cpf_cnpj: c.cpf_cnpj || '', tipo: c.tipo,
      endereco: c.endereco || '', status: c.status, empresa_fonte: c.empresa_fonte || 'PIXIFY', canal_cobranca: c.canal_cobranca || 'whatsapp',
    });
    setFicha(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;
    setIsSaving(true);
    if (editingId) await updateCliente(editingId, formData);
    else await createCliente(formData);
    setModalOpen(false);
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsSaving(true);
    const ok = await deleteCliente(deletingId);
    if (ok) { setDeletingId(null); setModalOpen(false); setFicha(null); }
    setIsSaving(false);
  };

  const contagem = {
    ativos: clientes.filter((c) => c.status === 'ativo').length,
    inativos: clientes.filter((c) => c.status !== 'ativo').length,
    todos: clientes.length,
  };

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const td = onlyDigits(busca);
    return clientes
      .filter((c) => status === 'todos' || (status === 'ativos' ? c.status === 'ativo' : c.status !== 'ativo'))
      .filter((c) => marca === 'todas' || c.empresa_fonte === marca)
      .filter((c) => !t || c.nome.toLowerCase().includes(t) || (c.email || '').toLowerCase().includes(t) || (!!td && (c.cpf_cnpj || '').includes(td)))
      .sort((a, b) => {
        if (ordem === 'mrr') return numeros(b.id).mrr - numeros(a.id).mrr;
        if (ordem === 'atraso') return numeros(b.id).atrasado - numeros(a.id).atrasado;
        return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
      });
  }, [clientes, status, marca, busca, ordem, numeros]);

  const { selectedIds, selectedItems, isSelected, isAllSelected, toggleSelect, toggleSelectAll, clearSelection } = useMultiSelect({
    items: lista,
    getItemId: (item) => item.id,
  });

  const handleBulkDelete = async () => {
    setIsSaving(true);
    const ok = await deleteMultipleClientes(Array.from(selectedIds));
    if (ok) { setBulkDeleteDialogOpen(false); clearSelection(); }
    setIsSaving(false);
  };

  const handleExport = () => {
    exportClientes(selectedItems.map((c) => ({ nome: c.nome, email: c.email || '', telefone: c.telefone || '', cpf_cnpj: c.cpf_cnpj || '', tipo: c.tipo, status: c.status })));
  };

  const comAtraso = clientes.filter((c) => numeros(c.id).atrasado > 0);
  const totalAtraso = comAtraso.reduce((s, c) => s + numeros(c.id).atrasado, 0);
  const semContato = clientes.filter((c) => c.status === 'ativo' && !c.telefone && !c.email).length;
  const marcasUsadas = EMPRESA_FONTE_OPTIONS.filter((o) => clientes.some((c) => c.empresa_fonte === o.value));

  const Selecao = ({ c }: { c: ClienteDB }) => {
    const sel = isSelected(c.id);
    return (
      <button type="button" aria-label={sel ? `Desmarcar ${c.nome}` : `Selecionar ${c.nome}`} aria-pressed={sel}
        onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }} className="no-touch-min shrink-0 rounded-full">
        <ClienteAvatar nome={c.nome} selected={sel} className="h-11 w-11 rounded-full text-[14px]" />
      </button>
    );
  };

  return (
    <main className="container py-4 md:py-6">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <PageHeader eyebrow="Gestão" title="Clientes">
          <button type="button" onClick={handleNew} aria-label="Novo cliente" className={btn.primary}><Plus className="h-4 w-4" /> Novo cliente</button>
        </PageHeader>

        {/* avisos úteis */}
        {(comAtraso.length > 0 || semContato > 0) && (
          <div className="flex flex-wrap gap-2">
            {comAtraso.length > 0 && (
              <button type="button" onClick={() => { setOrdem('atraso'); setStatus('todos'); }} className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-3 py-1.5 text-[12.5px] text-danger-fg">
                <AlertTriangle className="h-3.5 w-3.5" />{comAtraso.length} {comAtraso.length === 1 ? 'cliente com atraso' : 'clientes com atraso'} · {formatCurrency(totalAtraso)}
              </button>
            )}
            {semContato > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-3 py-1.5 text-[12.5px] text-warning-fg"><Phone className="h-3.5 w-3.5" />{semContato} sem WhatsApp nem e-mail: as cobranças não saem</span>}
          </div>
        )}

        {/* barra única */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 w-full items-center gap-2 rounded-full border border-border bg-surface px-3.5 sm:w-72">
            <Search className="h-4 w-4 text-foreground-muted" />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, e-mail, CNPJ ou CPF" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-foreground-muted" />
          </label>
          <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
            {([['ativos', 'Ativos'], ['inativos', 'Inativos'], ['todos', 'Todos']] as const).map(([v, r]) => (
              <button key={v} type="button" onClick={() => setStatus(v)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px]', status === v ? 'bg-foreground text-background' : 'text-foreground-muted hover:text-foreground')}>{r}<span className="text-[11px] opacity-70">{contagem[v]}</span></button>
            ))}
          </div>
          {marcasUsadas.length > 1 && (
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 scrollbar-hide">
              {(['todas', ...marcasUsadas.map((o) => o.value)] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMarca(m as EmpresaFonte | 'todas')} className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px]', marca === m ? 'bg-foreground text-background' : 'text-foreground-muted hover:text-foreground')}>
                  {m !== 'todas' && <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: corMarca(m) }} />}{m === 'todas' ? 'Todas as marcas' : m}
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <select aria-label="Ordenar" value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className="h-10 appearance-none rounded-full border border-border bg-surface pl-8 pr-8 text-[13px] text-foreground outline-none">
                <option value="nome">Nome (A–Z)</option><option value="mrr">Maior MRR</option><option value="atraso">Em atraso</option>
              </select>
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
            </div>
            <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
              <button type="button" onClick={() => setVista('cards')} aria-label="Cartões" aria-pressed={vista === 'cards'} className={cn('grid h-8 w-8 place-items-center rounded-full', vista === 'cards' ? 'bg-foreground text-background' : 'text-foreground-muted')}><LayoutGrid className="h-4 w-4" /></button>
              <button type="button" onClick={() => setVista('lista')} aria-label="Lista" aria-pressed={vista === 'lista'} className={cn('grid h-8 w-8 place-items-center rounded-full', vista === 'lista' ? 'bg-foreground text-background' : 'text-foreground-muted')}><List className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-[22px] border border-border bg-surface" />)}
          </div>
        ) : lista.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border px-6 py-14 text-center">
            <p className="text-[15px] text-foreground">{clientes.length ? 'Nenhum cliente com esses filtros.' : 'Nenhum cliente ainda.'}</p>
            <p className="mt-1 text-[13px] text-foreground-muted">{clientes.length ? 'Limpe a busca ou troque o filtro.' : 'Cadastre o primeiro para lançar receitas e cobrar.'}</p>
            {!clientes.length && <button type="button" onClick={handleNew} className={cn(btn.primary, 'mt-4')}><Plus className="h-4 w-4" />Novo cliente</button>}
          </div>
        ) : vista === 'cards' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lista.map((c) => {
              const n = numeros(c.id);
              return (
                <div key={c.id} role="button" tabIndex={0} onClick={() => setFicha(c)} onKeyDown={(e) => { if (e.key === 'Enter') setFicha(c); }}
                  className={cn('group flex cursor-pointer flex-col rounded-[22px] border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg', isSelected(c.id) ? 'border-foreground' : 'border-border', c.status !== 'ativo' && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <Selecao c={c} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-semibold text-foreground">{c.nome}</span>
                      <span className="flex items-center gap-1 truncate text-[12px] text-foreground-muted">{c.tipo === 'PJ' ? <Building2 className="h-3 w-3 shrink-0" /> : <UserRound className="h-3 w-3 shrink-0" />}{c.cpf_cnpj ? formatCPFCNPJ(c.cpf_cnpj) : c.tipo === 'PJ' ? 'Empresa' : 'Pessoa física'}</span>
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2/60 p-3">
                    <span><span className="block text-[11px] text-foreground-muted">MRR</span><span className="block text-[15px] font-semibold tabular-nums text-foreground">{n.mrr ? formatCurrency(n.mrr) : '—'}</span></span>
                    <span>{n.atrasado
                      ? <><span className="block text-[11px] text-danger-fg">Atrasado</span><span className="block text-[15px] font-semibold tabular-nums text-danger-fg">{formatCurrency(n.atrasado)}</span></>
                      : <><span className="block text-[11px] text-foreground-muted">Em aberto</span><span className="block text-[15px] font-semibold tabular-nums text-foreground">{n.aberto ? formatCurrency(n.aberto) : '—'}</span></>}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><MarcaChip m={c.empresa_fonte} />{c.status !== 'ativo' && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-foreground-muted">Inativo</span>}</span>
                    <span className="flex gap-1">
                      {c.telefone && <span title={formatPhone(c.telefone)} className="grid h-8 w-8 place-items-center rounded-full border border-border text-foreground-muted"><MessageCircle className="h-3.5 w-3.5" /></span>}
                      {c.email && <span title={c.email} className="grid h-8 w-8 place-items-center rounded-full border border-border text-foreground-muted"><Mail className="h-3.5 w-3.5" /></span>}
                      {!c.telefone && !c.email && <span className="rounded-full bg-warning-bg px-2 py-1 text-[11px] text-warning-fg">sem contato</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[24px] border border-border bg-surface [&>div:last-child]:rounded-b-[24px]">
            <div className="hidden grid-cols-[22px_minmax(0,2fr)_minmax(0,1.4fr)_110px_110px_110px] items-center gap-3 border-b border-border px-5 py-2.5 text-[12px] text-foreground-muted md:grid">
              <button type="button" onClick={toggleSelectAll} aria-label="Selecionar todos" className={cn('grid h-5 w-5 place-items-center rounded-md border', isAllSelected ? 'border-foreground bg-foreground text-background' : 'border-border-strong')}>{isAllSelected && <Check className="h-3.5 w-3.5" />}</button>
              <span>Cliente</span><span>Contato</span><span>Marca</span><span className="text-right">MRR</span><span className="text-right">Situação</span>
            </div>
            {lista.map((c) => {
              const n = numeros(c.id);
              const sel = isSelected(c.id);
              return (
                <div key={c.id} role="button" tabIndex={0} onClick={() => setFicha(c)} onKeyDown={(e) => { if (e.key === 'Enter') setFicha(c); }}
                  className={cn('grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-surface-2/50 md:grid-cols-[22px_minmax(0,2fr)_minmax(0,1.4fr)_110px_110px_110px] md:px-5', sel && 'bg-primary/5', c.status !== 'ativo' && 'opacity-60')}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }} aria-label={`Selecionar ${c.nome}`} className={cn('hidden h-5 w-5 place-items-center rounded-md border md:grid', sel ? 'border-foreground bg-foreground text-background' : 'border-border-strong')}>{sel && <Check className="h-3.5 w-3.5" />}</button>
                  <span className="flex min-w-0 items-center gap-3">
                    <ClienteAvatar nome={c.nome} className="h-9 w-9 rounded-full text-[12.5px]" />
                    <span className="min-w-0"><span className="block truncate text-[14.5px] font-semibold text-foreground">{c.nome}</span><span className="block truncate text-[12px] text-foreground-muted">{c.cpf_cnpj ? formatCPFCNPJ(c.cpf_cnpj) : c.tipo === 'PJ' ? 'Empresa' : 'Pessoa física'}</span></span>
                  </span>
                  <span className="hidden truncate text-[12.5px] text-foreground-muted md:block">{c.telefone ? formatPhone(c.telefone) : c.email || <span className="text-warning-fg">sem contato</span>}</span>
                  <span className="hidden md:block"><MarcaChip m={c.empresa_fonte} /></span>
                  <span className="hidden text-right text-[14px] font-semibold tabular-nums text-foreground md:block">{n.mrr ? formatCurrency(n.mrr) : '—'}</span>
                  <span className={cn('text-right text-[13.5px] font-semibold tabular-nums', n.atrasado ? 'text-danger-fg' : 'text-foreground-muted')}>{n.atrasado ? formatCurrency(n.atrasado) : 'em dia'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ficha */}
      <Sheet open={!!ficha} onOpenChange={(o) => !o && setFicha(null)}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[880px]')}>
          {ficha && <Ficha c={ficha} n={numeros(ficha.id)} fechar={() => setFicha(null)} editar={() => handleEdit(ficha)} excluir={() => setDeletingId(ficha.id)} />}
        </SheetContent>
      </Sheet>

      {/* Criar / editar */}
      <Sheet open={modalOpen} onOpenChange={setModalOpen}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[640px]')}>
          {modalOpen && (
            <FormCliente editando={!!editingId} form={formData} setForm={setFormData} onSubmit={handleSubmit} fechar={() => setModalOpen(false)} isSaving={isSaving}
              excluir={editingId ? () => setDeletingId(editingId) : undefined} />
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(o) => { if (!o) setDeletingId(null); }}
        title="Excluir cliente"
        description="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isSaving}
      />
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Excluir clientes"
        description={`Tem certeza que deseja excluir ${selectedIds.size} clientes? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir todos"
        variant="destructive"
        onConfirm={handleBulkDelete}
        isLoading={isSaving}
      />
      <MultiSelectBar selectedCount={selectedIds.size} onClear={clearSelection} onDelete={() => setBulkDeleteDialogOpen(true)} onExport={handleExport} />
    </main>
  );
}

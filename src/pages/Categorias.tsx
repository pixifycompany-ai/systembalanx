import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ChevronDown, Lock, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useActionParam } from '@/hooks/useActionParam';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { supabase } from '@/integrations/supabase/client';
import { buscarTodas } from '@/lib/buscarTodas';
import { EMPRESA_FONTE_OPTIONS, type EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';
import { PageHeader, Segmented, ModalHeader, ModalFooter, ModalShell, Campo } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';
import {
  fetchCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  CATEGORIA_CORES,
  GRUPO_DRE_RECEITA,
  GRUPO_DRE_DESPESA,
  grupoDreLabel,
  type Categoria,
  type CategoriaFormData,
  type GrupoDRE,
} from '@/api/categorias';
import { digitarMoeda, mostrarMoeda } from '@/lib/moeda';

type Tipo = 'receita' | 'despesa';

/** Explicação curta de cada linha do DRE (ajuda a escolher o grupo certo). */
const GRUPO_DICA: Record<GrupoDRE, string> = {
  rec_servico: 'Receita principal: o que você vende',
  rec_outra: 'Juros, comissões, licenças e o que não é a atividade principal',
  imposto: 'DAS, ISS, IOF: sai antes de chegar na receita líquida',
  custo_variavel: 'O que cresce junto com as vendas: freelas, mídia do cliente',
  desp_comercial: 'Anúncios da própria empresa, comissões de venda',
  desp_administrativa: 'Contador, softwares, aluguel, escritório',
  desp_pessoal: 'Salários, pró-labore e benefícios',
  desp_operacional: 'O resto do dia a dia: alimentação, deslocamento',
  distribuicao_lucro: 'Fica abaixo do lucro no DRE: não é despesa',
};

type UsoMes = Record<string, { valor: number; qtd: number }>;

/** Quanto cada categoria movimentou no mês atual (competência, mesmo critério do DRE). */
async function fetchUsoDoMes(): Promise<UsoMes> {
  const ini = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const fim = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const [rec, desp] = await Promise.all([
    buscarTodas<{ valor: number; categoria_id: string | null }>(() => supabase.from('receitas').select('id, valor, categoria_id').gte('data_competencia', ini).lte('data_competencia', fim)),
    buscarTodas<{ valor: number; categoria_id: string | null; fornecedor: string | null }>(() => supabase.from('despesas').select('id, valor, categoria_id, fornecedor').gte('data_competencia', ini).lte('data_competencia', fim)),
  ]);
  const uso: UsoMes = {};
  const somar = (id: string | null, v: number) => {
    if (!id) return;
    const u = (uso[id] ??= { valor: 0, qtd: 0 });
    u.valor += Number(v) || 0;
    u.qtd += 1;
  };
  (rec.data ?? []).forEach((r) => somar(r.categoria_id, r.valor));
  // Sombra da fatura e pagamento da fatura não são despesa nova (contariam em dobro).
  (desp.data ?? []).forEach((d) => {
    if (d.fornecedor === '[fatura]' || d.fornecedor === '[pagamento-fatura]') return;
    somar(d.categoria_id, d.valor);
  });
  return uso;
}

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [uso, setUso] = useState<UsoMes>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tipo>('despesa');
  const [busca, setBusca] = useState('');
  const [fechados, setFechados] = useState<string[]>([]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  useActionParam('novo', () => handleNew());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<CategoriaFormData>({
    nome: '',
    tipo: 'despesa',
    cor: '#3B82F6',
    empresa_fonte: null,
    grupo_dre: null,
  });
  // Orçamento mensal digitado no formulário (texto, "800" ou "1.200,50"; vazio = sem orçamento).
  const [orcTxt, setOrcTxt] = useState('');

  useEffect(() => {
    loadCategorias();
    fetchUsoDoMes().then(setUso).catch(() => { /* o valor do mês é só informativo */ });
  }, []);

  const loadCategorias = async () => {
    try {
      setIsLoading(true);
      const data = await fetchCategorias();
      setCategorias(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao carregar categorias',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setEditingCategoria(null);
    setFormData({ nome: '', tipo: activeTab, cor: '#3B82F6', empresa_fonte: null, grupo_dre: null });
    setOrcTxt('');
    setModalOpen(true);
  };

  // Todas as categorias são editáveis
  const handleEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setFormData({
      nome: categoria.nome,
      tipo: categoria.tipo,
      cor: categoria.cor,
      empresa_fonte: categoria.empresa_fonte ?? null,
      grupo_dre: categoria.grupo_dre ?? null,
    });
    setOrcTxt(categoria.orcamento_mensal ? String(categoria.orcamento_mensal).replace('.', ',') : '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast({ title: 'Erro', description: 'O nome da categoria é obrigatório', variant: 'destructive' });
      return;
    }
    const orcNum = orcTxt.trim() ? Number(orcTxt.replace(/\./g, '').replace(',', '.')) : null;
    if (orcNum !== null && !(orcNum > 0)) {
      toast({ title: 'Erro', description: 'Orçamento inválido. Use um valor maior que zero ou deixe vazio.', variant: 'destructive' });
      return;
    }
    // Só manda o orçamento se for despesa e se mudou (o campo pode não existir em bancos antigos).
    const orcAntes = editingCategoria?.orcamento_mensal != null ? Number(editingCategoria.orcamento_mensal) : null;
    const dados: CategoriaFormData = formData.tipo === 'despesa' && (orcNum !== orcAntes)
      ? { ...formData, orcamento_mensal: orcNum } : formData;
    setIsSaving(true);
    try {
      if (editingCategoria) {
        const updated = await updateCategoria(editingCategoria.id, dados);
        setCategorias(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast({ title: 'Categoria atualizada com sucesso!' });
      } else {
        const created = await createCategoria(dados);
        setCategorias(prev => [...prev, created]);
        toast({ title: 'Categoria criada com sucesso!' });
      }
      setModalOpen(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar categoria',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Todas as categorias podem ser excluídas
  const handleDelete = async () => {
    if (!deletingId) return;
    setIsSaving(true);
    try {
      await deleteCategoria(deletingId);
      setCategorias(prev => prev.filter(c => c.id !== deletingId));
      toast({ title: 'Categoria excluída com sucesso!' });
      setDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir categoria',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setDeletingId(null);
    }
  };

  const opcoes = activeTab === 'receita' ? GRUPO_DRE_RECEITA : GRUPO_DRE_DESPESA;
  const doTipo = useMemo(
    () => categorias.filter((c) => c.tipo === activeTab && (!busca || c.nome.toLowerCase().includes(busca.toLowerCase()))),
    [categorias, activeTab, busca],
  );
  const valorDe = (c: Categoria) => uso[c.id]?.valor ?? 0;
  const orcDe = (c: Categoria) => (c.orcamento_mensal ? Number(c.orcamento_mensal) : 0);
  const comOrc = activeTab === 'despesa'
    ? categorias.filter((c) => c.tipo === 'despesa' && orcDe(c) > 0)
      .map((c) => ({ c, gasto: valorDe(c), orc: orcDe(c), pct: (valorDe(c) / orcDe(c)) * 100 }))
      .sort((a, b) => b.pct - a.pct)
    : [];
  const tomOrc = (pct: number) => (pct > 100 ? 'bg-danger-fg' : pct >= 85 ? 'bg-warning-fg' : 'bg-success-fg');
  const semGrupo = doTipo.filter((c) => !c.grupo_dre || !opcoes.some((o) => o.value === c.grupo_dre));
  const grupos = opcoes
    .map((o) => ({ k: o.value, r: o.label, d: GRUPO_DICA[o.value], itens: doTipo.filter((c) => c.grupo_dre === o.value).sort((a, b) => valorDe(b) - valorDe(a)) }))
    .filter((g) => g.itens.length);
  const totalMes = doTipo.reduce((s, c) => s + valorDe(c), 0);
  const contar = (t: Tipo) => categorias.filter((c) => c.tipo === t).length;
  const mesNome = format(new Date(), 'MMMM', { locale: ptBR });

  const formGrupos = formData.tipo === 'receita' ? GRUPO_DRE_RECEITA : GRUPO_DRE_DESPESA;
  const usoEditando = editingCategoria ? uso[editingCategoria.id] : undefined;

  return (
    <main className="mx-auto w-full max-w-[1180px] space-y-5 py-4 md:py-6">
      <PageHeader eyebrow="Ajustes" title="Categorias">
        <button type="button" onClick={handleNew} aria-label="Nova categoria" className={cn(btn.primary, 'max-sm:hidden')}>
          <Plus className="h-4 w-4" />Nova categoria
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Tipo>
          className="max-sm:w-full"
          value={activeTab}
          onChange={setActiveTab}
          opts={[
            ['receita', <span key="r" className="inline-flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Receitas <span className="text-[11px] opacity-70">{contar('receita')}</span></span>],
            ['despesa', <span key="d" className="inline-flex items-center gap-1.5"><TrendingDown className="h-4 w-4" />Despesas <span className="text-[11px] opacity-70">{contar('despesa')}</span></span>],
          ]}
        />
        <label className="flex h-10 w-full items-center gap-2 rounded-full border border-border bg-surface px-3.5 sm:w-72">
          <Search className="h-4 w-4 text-foreground-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar categoria" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-foreground-muted" />
        </label>
        <p className="ml-auto text-[13px] text-foreground-muted max-sm:ml-0 max-sm:w-full max-sm:px-1">
          <span className="first-letter:uppercase">{mesNome}</span>: <b className="font-semibold tabular-nums text-foreground">{formatCurrency(totalMes)}</b> em {activeTab === 'receita' ? 'receitas' : 'despesas'}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-[24px] border border-border bg-surface" />
          ))}
        </div>
      ) : doTipo.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border px-6 py-14 text-center">
          <p className="text-[15px] text-foreground">{busca ? 'Nenhuma categoria com esse nome.' : 'Nenhuma categoria ainda.'}</p>
          <p className="mt-1 text-[13px] text-foreground-muted">Crie categorias para organizar receitas e despesas no DRE.</p>
          <button type="button" onClick={handleNew} className={cn(btn.primary, 'mt-4')}><Plus className="h-4 w-4" />Nova categoria</button>
        </div>
      ) : (
        <>
          {comOrc.length > 0 && (
            <section className="rounded-[24px] border border-border bg-surface p-4 sm:p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold text-foreground">Orçamento de <span className="lowercase">{mesNome}</span></p>
                <p className="text-[12.5px] tabular-nums text-foreground-muted">
                  {formatCurrency(comOrc.reduce((s2, x) => s2 + x.gasto, 0))} de {formatCurrency(comOrc.reduce((s2, x) => s2 + x.orc, 0))}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                {comOrc.map(({ c, gasto, orc, pct }) => (
                  <button key={c.id} type="button" onClick={() => handleEdit(c)} className="text-left">
                    <span className="flex items-center gap-2 text-[13.5px]">
                      <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.cor }} />
                      <span className="min-w-0 flex-1 truncate text-foreground">{c.nome}</span>
                      <span className={cn('shrink-0 tabular-nums', pct > 100 ? 'font-semibold text-danger-fg' : 'text-foreground-muted')}>{Math.round(pct)}%</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <span className={cn('block h-full rounded-full', tomOrc(pct))} style={{ width: `${Math.min(100, pct)}%` }} />
                    </span>
                    <span className="mt-1 block text-[11.5px] tabular-nums text-foreground-muted">
                      {formatCurrency(gasto)} de {formatCurrency(orc)} · {gasto > orc ? <b className="font-semibold text-danger-fg">passou {formatCurrency(gasto - orc)}</b> : `sobram ${formatCurrency(orc - gasto)}`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {semGrupo.length > 0 && (
            <section className="rounded-[22px] border border-warning-fg/30 bg-warning-bg/70 p-4">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-warning-fg"><AlertTriangle className="h-4 w-4" />{semGrupo.length} sem grupo no DRE</p>
              <p className="mb-2 text-[12.5px] text-warning-fg/90">Elas ficam fora do lugar certo nos relatórios. Toque para escolher o grupo.</p>
              <div className="flex flex-wrap gap-2">
                {semGrupo.map((c) => (
                  <button key={c.id} type="button" onClick={() => handleEdit(c)} className="inline-flex h-9 items-center gap-2 rounded-full bg-surface px-3.5 text-[13px] text-foreground shadow-sm hover:bg-surface-2">
                    <i className="h-2 w-2 rounded-full" style={{ background: c.cor }} />{c.nome}
                    {valorDe(c) > 0 && <span className="text-foreground-muted">· {formatCurrency(valorDe(c))}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {grupos.map((g) => {
              const aberto = !fechados.includes(g.k);
              const totalG = g.itens.reduce((s, c) => s + valorDe(c), 0);
              const max = Math.max(1, ...g.itens.map(valorDe));
              return (
                <section key={g.k} className="rounded-[24px] border border-border bg-surface">
                  <button type="button" onClick={() => setFechados((f) => aberto ? [...f, g.k] : f.filter((x) => x !== g.k))} aria-expanded={aberto} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-foreground">{g.r} <span className="font-normal text-foreground-muted">· {g.itens.length}</span></span>
                      <span className="block truncate text-[12px] text-foreground-muted">{g.d}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[15px] font-semibold tabular-nums text-foreground">{formatCurrency(totalG)}</span>
                      <span className="block text-[11px] text-foreground-muted">no mês</span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-foreground-muted transition-transform', aberto && 'rotate-180')} />
                  </button>
                  {aberto && (
                    <div className="border-t border-border px-2 pb-2">
                      {g.itens.map((c) => {
                        const u = uso[c.id];
                        return (
                          <div
                            key={c.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleEdit(c)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(c); } }}
                            className="group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-2/60"
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c.cor} 14%, transparent)` }}>
                              <i className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-[14px] text-foreground">{c.nome}</span>
                                {c.is_padrao && <span title="Categoria padrão do BALANX" className="inline-flex shrink-0 items-center gap-0.5 text-[10.5px] text-foreground-subtle"><Lock className="h-2.5 w-2.5" />padrão</span>}
                                {c.empresa_fonte && <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px] text-foreground-muted">{c.empresa_fonte}</span>}
                              </span>
                              <span className="mt-1 flex items-center gap-2">
                                {orcDe(c) > 0 ? (
                                  <>
                                    <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-surface-2 sm:w-24"><span className={cn('block h-full rounded-full', tomOrc((valorDe(c) / orcDe(c)) * 100))} style={{ width: `${Math.min(100, (valorDe(c) / orcDe(c)) * 100)}%` }} /></span>
                                    <span className="whitespace-nowrap text-[11.5px] text-foreground-muted">{Math.round((valorDe(c) / orcDe(c)) * 100)}% de {formatCurrency(orcDe(c))}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-surface-2 sm:w-24"><span className="block h-full rounded-full" style={{ width: `${(valorDe(c) / max) * 100}%`, background: c.cor }} /></span>
                                    <span className="whitespace-nowrap text-[11.5px] text-foreground-muted">{u?.qtd ? `${u.qtd} lançamento${u.qtd > 1 ? 's' : ''}` : 'sem uso no mês'}</span>
                                  </>
                                )}
                              </span>
                            </span>
                            <span className={cn('shrink-0 text-[14px] font-semibold tabular-nums', valorDe(c) ? 'text-foreground' : 'text-foreground-subtle')}>{valorDe(c) ? formatCurrency(valorDe(c)) : '—'}</span>
                            <span className="flex shrink-0 md:opacity-0 md:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => handleEdit(c)} aria-label={`Editar ${c.nome}`} className="no-touch-min grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => { setDeletingId(c.id); setDeleteDialogOpen(true); }} aria-label={`Excluir ${c.nome}`} className="no-touch-min hidden h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-danger-bg hover:text-danger-fg md:grid"><Trash2 className="h-3.5 w-3.5" /></button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* Criar / editar */}
      <Sheet open={modalOpen} onOpenChange={setModalOpen}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
          <ModalShell>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <ModalHeader eyebrow="Cadastro" title={editingCategoria ? 'Editar categoria' : 'Nova categoria'} onClose={() => setModalOpen(false)} />
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {/* prévia */}
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${formData.cor} 14%, transparent)` }}><i className="h-3 w-3 rounded-full" style={{ background: formData.cor }} /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-foreground">{formData.nome || 'Nome da categoria'}</span>
                    <span className="block text-[12px] text-foreground-muted">{formData.tipo === 'receita' ? 'Receita' : 'Despesa'} · DRE: {grupoDreLabel(formData.grupo_dre)}</span>
                  </span>
                </div>

                {!editingCategoria && (
                  <Segmented<Tipo>
                    value={formData.tipo}
                    onChange={(v) => setFormData((prev) => ({ ...prev, tipo: v, grupo_dre: null }))}
                    opts={[
                      ['receita', <span key="r" className="inline-flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Receita</span>],
                      ['despesa', <span key="d" className="inline-flex items-center gap-1.5"><TrendingDown className="h-4 w-4" />Despesa</span>],
                    ]}
                  />
                )}

                <Campo label="Nome">
                  <Input value={formData.nome} onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))} placeholder="Ex.: Mídia paga" required autoFocus={!editingCategoria} />
                </Campo>

                <div>
                  <p className="mb-1.5 text-[12.5px] text-foreground-muted">Onde entra no DRE</p>
                  <div className="space-y-1.5">
                    {formGrupos.map((o) => {
                      const sel = formData.grupo_dre === o.value;
                      return (
                        <button key={o.value} type="button" onClick={() => setFormData((prev) => ({ ...prev, grupo_dre: o.value }))}
                          className={cn('flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors', sel ? 'border-foreground bg-surface' : 'border-border hover:bg-surface-2/50')}>
                          <span className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border', sel ? 'border-foreground' : 'border-border-strong')}>{sel && <i className="h-2 w-2 rounded-full bg-foreground" />}</span>
                          <span><span className="block text-[13.5px] text-foreground">{o.label}</span><span className="block text-[12px] text-foreground-muted">{GRUPO_DICA[o.value]}</span></span>
                        </button>
                      );
                    })}
                    {!formData.grupo_dre && <p className="text-[12px] text-warning-fg">Sem grupo, a categoria fica em "A classificar" nos relatórios.</p>}
                  </div>
                </div>

                {formData.tipo === 'despesa' && (
                  <Campo label="Orçamento por mês (opcional)" hint="Quanto pode gastar nesta categoria por mês. A IARA avisa quanto ainda sobra.">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13.5px] text-foreground-muted">R$</span>
                      <Input value={orcTxt} onChange={(e) => setOrcTxt(mostrarMoeda(digitarMoeda(e.target.value)))} inputMode="numeric" placeholder="Sem orçamento" className="pl-10" />
                    </div>
                  </Campo>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="mb-2 text-[12.5px] text-foreground-muted">Cor</p>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIA_CORES.map((cor) => (
                        <button key={cor.value} type="button" onClick={() => setFormData((prev) => ({ ...prev, cor: cor.value }))} aria-label={cor.label} title={cor.label}
                          className={cn('no-touch-min h-8 w-8 rounded-full transition-transform', formData.cor === cor.value ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:scale-105')}
                          style={{ background: cor.value }} />
                      ))}
                    </div>
                  </div>
                  <Campo label="Marca" hint="Herdada pelos lançamentos">
                    <select
                      value={formData.empresa_fonte ?? '_geral'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, empresa_fonte: e.target.value === '_geral' ? null : (e.target.value as EmpresaFonte) }))}
                      className={cn(campoCls, 'sm:w-44')}
                    >
                      <option value="_geral">Geral (sem marca)</option>
                      {EMPRESA_FONTE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Campo>
                </div>

                {usoEditando && usoEditando.qtd > 0 && (
                  <p className="rounded-2xl bg-surface-2/70 p-3 text-[12.5px] text-foreground-muted">
                    Usada em <b className="font-semibold text-foreground">{usoEditando.qtd} lançamento{usoEditando.qtd > 1 ? 's' : ''}</b> este mês. Mudar o grupo do DRE muda onde eles aparecem nos relatórios.
                  </p>
                )}
              </div>
              <ModalFooter
                left={editingCategoria ? (
                  <button type="button" className={btn.danger} onClick={() => { setDeletingId(editingCategoria.id); setModalOpen(false); setDeleteDialogOpen(true); }}>
                    <Trash2 className="h-4 w-4" />Excluir
                  </button>
                ) : undefined}
              >
                <button type="button" className={btn.outline} onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className={btn.primary} disabled={isSaving}>
                  {isSaving ? <><LoadingSpinner size="sm" />Salvando…</> : editingCategoria ? 'Salvar' : 'Criar'}
                </button>
              </ModalFooter>
            </form>
          </ModalShell>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir categoria"
        description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        isLoading={isSaving}
        onConfirm={handleDelete}
      />
    </main>
  );
}

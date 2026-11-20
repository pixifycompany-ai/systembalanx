// Card de confirmação das ações que a IARA preparou: cliente, contrato e cobrança.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, FileSignature, Loader2, Receipt, UserPlus, X, AlertTriangle, CalendarClock, Trash2, ArrowRight, CalendarPlus, ListTodo, CheckCircle2, RotateCcw, Tags, ArrowLeftRight, CreditCard, MessageCircle, Target, PauseCircle, PlayCircle, Ban, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCPFCNPJ, formatCurrency, formatDate, formatPhone } from '@/utils/formatters';
import { useToast } from '@/hooks/use-toast';
import { executarAcoes, FORMA_LABEL, type AcaoIara, type ResultadoAcao } from '@/lib/acoesIara';

const RECORRENCIA: Record<string, string> = {
  mensal: 'por mês', trimestral: 'por trimestre', semestral: 'por semestre', anual: 'por ano',
  semanal: 'por semana', quinzenal: 'por quinzena', unico: 'pagamento único',
};

const Chip = ({ children, tom }: { children: React.ReactNode; tom?: 'info' | 'warn' }) => (
  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium',
    tom === 'info' ? 'bg-info-bg font-semibold text-info-fg' : tom === 'warn' ? 'bg-warning-bg font-semibold text-warning-fg' : 'bg-surface-2 text-foreground-muted')}>
    {children}
  </span>
);

/** "25/11 → 30/11" e "R$ 800 → R$ 900" (só o que muda). */
function Mudanca({ de, para }: { de: string; para: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-info-fg">
      <span className="line-through opacity-70">{de}</span><ArrowRight className="h-3 w-3" />{para}
    </span>
  );
}

/** Cabeçalho padrão de uma linha do card. */
function Topo({ icone, titulo, valor, tom }: { icone: React.ReactNode; titulo: React.ReactNode; valor?: number; tom?: 'ok' | 'perigo' }) {
  return (
    <div className="flex items-center gap-2">
      {icone}
      <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">{titulo}</span>
      {valor != null && (
        <span className={cn('shrink-0 font-heading text-[14px] font-semibold tabular-nums', tom === 'perigo' ? 'text-danger-fg' : tom === 'ok' ? 'text-success-fg' : 'text-foreground')}>
          {formatCurrency(valor)}
        </span>
      )}
    </div>
  );
}
const Linha = ({ children }: { children: React.ReactNode }) => <div className="border-b border-border px-3 py-2.5 last:border-b-0">{children}</div>;
const Chips = ({ children }: { children: React.ReactNode }) => <div className="mt-1.5 flex flex-wrap gap-1">{children}</div>;
const mesAno = (p: string) => p.split('-').reverse().join('/');

/** Cards das ações de baixa, receita, categoria, transferência, fatura, contrato, WhatsApp e meta. */
function ItemExtra({ a }: { a: AcaoIara }) {
  switch (a.tipo) {
    case 'dar_baixa': {
      const rec = a.lanc === 'receita';
      return (
        <Linha>
          <Topo icone={<CheckCircle2 className="h-4 w-4 shrink-0 text-success-fg" />} titulo={<>{rec ? 'Marcar como recebida' : 'Marcar como paga'} · {a.descricao}</>} valor={a.valor} tom={rec ? 'ok' : undefined} />
          <Chips>
            {a.quem && <Chip>{a.quem}</Chip>}
            <Chip tom="info">{rec ? 'recebida' : 'paga'} em {formatDate(a.data)}</Chip>
            {a.conta_nome && <Chip>{rec ? 'entra em' : 'sai de'} {a.conta_nome}</Chip>}
            <Chip>vencia {formatDate(a.vencimento)}</Chip>
            {a.via_asaas && <Chip tom="info">também no Asaas</Chip>}
          </Chips>
        </Linha>
      );
    }
    case 'alterar_receita':
      return (
        <Linha>
          <Topo icone={<CalendarClock className="h-4 w-4 shrink-0 text-primary" />} titulo={<>Alterar receita · {a.descricao}</>} />
          <Chips>
            {a.cliente_nome && <Chip>{a.cliente_nome}</Chip>}
            {a.novo_vencimento ? <Mudanca de={formatDate(a.vencimento_atual)} para={formatDate(a.novo_vencimento)} /> : <Chip>vence {formatDate(a.vencimento_atual)}</Chip>}
            {a.novo_valor ? <Mudanca de={formatCurrency(a.valor_atual)} para={formatCurrency(a.novo_valor)} /> : <Chip>{formatCurrency(a.valor_atual)}</Chip>}
            {a.nova_descricao && <Mudanca de={a.descricao} para={a.nova_descricao} />}
            {a.de_contrato && <Chip tom="warn">só este mês</Chip>}
          </Chips>
        </Linha>
      );
    case 'excluir_receita':
      return (
        <Linha>
          <Topo icone={<Trash2 className="h-4 w-4 shrink-0 text-danger-fg" />} titulo={<>Excluir receita · {a.descricao}</>} valor={a.valor} tom="perigo" />
          <Chips>
            {a.cliente_nome && <Chip>{a.cliente_nome}</Chip>}
            <Chip>vence {formatDate(a.vencimento)}</Chip>
            {a.de_contrato && <Chip tom="warn">só este mês · o contrato continua</Chip>}
          </Chips>
        </Linha>
      );
    case 'alterar_categoria':
      return (
        <Linha>
          <Topo icone={<Tags className="h-4 w-4 shrink-0 text-primary" />} titulo={<>Trocar categoria · {a.quantidade} lançamento{a.quantidade === 1 ? '' : 's'}</>} valor={a.total} />
          <Chips><Chip tom="info">para {a.categoria_nome}</Chip><Chip>{a.lanc === 'receita' ? 'receitas' : 'despesas'}</Chip></Chips>
          <ul className="mt-1.5 space-y-0.5">
            {a.exemplos.map((x, i) => (
              <li key={i} className="text-[11.5px] leading-snug text-foreground-muted">
                {[x.quem, x.descricao].filter(Boolean).join(' · ')} — {formatCurrency(x.valor)} · {formatDate(x.data)} · era <span className="line-through">{x.de}</span>
              </li>
            ))}
            {a.quantidade > a.exemplos.length && <li className="text-[11.5px] text-foreground-muted">+ {a.quantidade - a.exemplos.length} lançamento(s)</li>}
          </ul>
        </Linha>
      );
    case 'transferencia':
      return (
        <Linha>
          <Topo icone={<ArrowLeftRight className="h-4 w-4 shrink-0 text-primary" />} titulo={<>Transferência{a.descricao ? ` · ${a.descricao}` : ''}</>} valor={a.valor} />
          <Chips>
            <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-info-fg">{a.origem_nome}<ArrowRight className="h-3 w-3" />{a.destino_nome}</span>
            <Chip>{formatDate(a.data)}</Chip>
          </Chips>
        </Linha>
      );
    case 'pagar_fatura':
      return (
        <Linha>
          <Topo icone={<CreditCard className="h-4 w-4 shrink-0 text-primary" />} titulo={<>Pagar fatura · {a.cartao_nome}</>} valor={a.valor} />
          <Chips>
            <Chip>fatura de {a.fatura_nome}</Chip>
            <Chip tom="info">sai de {a.conta_nome}</Chip>
            <Chip>pago em {formatDate(a.data)}</Chip>
            <Chip>vence {formatDate(a.vencimento)}</Chip>
            {a.valor < a.em_aberto - 0.005 && <Chip tom="warn">parcial · falta {formatCurrency(a.em_aberto - a.valor)}</Chip>}
          </Chips>
        </Linha>
      );
    case 'alterar_contrato': {
      const cfg = {
        pausar: { icone: <PauseCircle className="h-4 w-4 shrink-0 text-warning-fg" />, nome: 'Pausar contrato' },
        reativar: { icone: <PlayCircle className="h-4 w-4 shrink-0 text-success-fg" />, nome: 'Reativar contrato' },
        encerrar: { icone: <Ban className="h-4 w-4 shrink-0 text-danger-fg" />, nome: 'Encerrar contrato' },
        reajustar: { icone: <TrendingUp className="h-4 w-4 shrink-0 text-primary" />, nome: 'Reajustar contrato' },
      }[a.acao];
      return (
        <Linha>
          <Topo icone={cfg.icone} titulo={<>{cfg.nome} · {a.descricao}</>} valor={a.acao === 'reajustar' ? undefined : a.valor} />
          <Chips>
            {a.cliente_nome && <Chip>{a.cliente_nome}</Chip>}
            {a.acao === 'pausar' && <Chip tom="info">de {formatDate(a.desde!)} {a.ate ? `até ${formatDate(a.ate)}` : 'até reativar'}</Chip>}
            {a.acao === 'reativar' && a.pausado_desde && <Chip>pausado desde {formatDate(a.pausado_desde)}</Chip>}
            {a.acao === 'encerrar' && <Chip tom="info">encerra em {formatDate(a.data!)}</Chip>}
            {a.acao === 'reajustar' && <Mudanca de={formatCurrency(a.valor)} para={formatCurrency(a.novo_valor || 0)} />}
            {a.acao === 'reajustar' && <Chip>a partir de {formatDate(a.vigencia!)}</Chip>}
            {a.no_asaas && <Chip tom="info">{a.acao === 'encerrar' ? 'para a assinatura no Asaas' : a.acao === 'pausar' ? 'suspende no Asaas' : a.acao === 'reativar' ? 'volta a cobrar no Asaas' : 'muda no Asaas'}</Chip>}
          </Chips>
          {a.acao === 'reajustar' && a.motivo && <p className="mt-1 text-[11.5px] text-foreground-muted">{a.motivo}</p>}
          {a.acao === 'encerrar' && !!a.receitas_futuras && (
            <p className="mt-1.5 rounded-[12px] bg-warning-bg px-2.5 py-1.5 text-[11.5px] text-warning-fg">
              {a.receitas_futuras} receita{a.receitas_futuras === 1 ? '' : 's'} futura{a.receitas_futuras === 1 ? '' : 's'} em aberto {a.receitas_futuras === 1 ? 'sai' : 'saem'} ({formatCurrency(a.total_futuras || 0)}). O que já foi recebido fica.
            </p>
          )}
        </Linha>
      );
    }
    case 'lembrete_whatsapp':
      return (
        <Linha>
          <Topo icone={<MessageCircle className="h-4 w-4 shrink-0 text-success-fg" />} titulo={<>Lembrete no WhatsApp · {a.cliente_nome}</>} valor={a.valor} />
          <Chips>
            <Chip>{formatPhone(a.telefone)}</Chip>
            <Chip tom={a.vencida ? 'warn' : undefined}>{a.vencida ? 'venceu' : 'vence'} {formatDate(a.vencimento)}</Chip>
          </Chips>
          <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-[12px] bg-success-bg/60 px-3 py-2 text-[12px] leading-[1.45] text-foreground">{a.texto}</p>
        </Linha>
      );
    case 'definir_meta':
      return (
        <Linha>
          <Topo icone={<Target className="h-4 w-4 shrink-0 text-primary" />} titulo={<>Meta de faturamento · {mesAno(a.periodo)}</>} />
          <Chips>
            <Mudanca de={a.atual != null ? formatCurrency(a.atual) : `${formatCurrency(15000)} (padrão)`} para={formatCurrency(a.valor)} />
            <Chip>recebido no mês</Chip>
          </Chips>
        </Linha>
      );
    default:
      return null;
  }
}

function Item({ a, usarExistente, setUsarExistente }: { a: AcaoIara; usarExistente: boolean; setUsarExistente: (v: boolean) => void }) {
  const extra = ItemExtra({ a });
  if (extra) return extra;
  if (a.tipo === 'compromisso' || a.tipo === 'tarefa') {
    const comp = a.tipo === 'compromisso';
    return (
      <div className="border-b border-border px-3 py-2.5 last:border-b-0">
        <div className="flex items-center gap-2">
          {comp ? <CalendarPlus className="h-4 w-4 shrink-0 text-primary" /> : <ListTodo className="h-4 w-4 shrink-0 text-primary" />}
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">{comp ? 'Compromisso' : 'Tarefa'} · {a.titulo}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {comp
            ? <Chip>{formatDate(a.dia)}{a.hora_inicio ? ` · ${a.hora_inicio}${a.hora_fim ? `–${a.hora_fim}` : ''}` : ' · dia inteiro'}</Chip>
            : a.data ? <Chip>até {formatDate(a.data)}</Chip> : <Chip>sem data</Chip>}
          {a.cliente_nome && <Chip>{a.cliente_nome}</Chip>}
          {!comp && a.lista_nome && <Chip>lista {a.lista_nome}</Chip>}
          {comp && a.lembrete_min != null && <Chip>lembrete {a.lembrete_min >= 1440 ? `${Math.round(a.lembrete_min / 1440)} dia(s)` : a.lembrete_min >= 60 ? `${Math.round(a.lembrete_min / 60)} h` : `${a.lembrete_min} min`} antes</Chip>}
        </div>
        {a.notas && <p className="mt-1 text-[11.5px] text-foreground-muted">{a.notas}</p>}
      </div>
    );
  }
  if (a.tipo === 'concluir_tarefa') {
    return (
      <div className="border-b border-border px-3 py-2.5 last:border-b-0">
        <div className="flex items-center gap-2">
          {a.concluida ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-fg" /> : <RotateCcw className="h-4 w-4 shrink-0 text-primary" />}
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">
            {a.concluida ? 'Concluir tarefa' : 'Reabrir tarefa'} · {a.titulo}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1"><Chip>{a.quando}</Chip></div>
      </div>
    );
  }
  if (a.tipo === 'alterar_agenda') {
    return (
      <div className="border-b border-border px-3 py-2.5 last:border-b-0">
        <div className="flex items-center gap-2">
          {a.item_tipo === 'tarefa' ? <ListTodo className="h-4 w-4 shrink-0 text-primary" /> : <CalendarClock className="h-4 w-4 shrink-0 text-primary" />}
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">
            Alterar {a.item_tipo === 'tarefa' ? 'tarefa' : 'compromisso'} · {a.titulo}
          </span>
        </div>
        <div className="mt-1.5 flex flex-col items-start gap-1">
          {a.mudancas.map((m) => (
            <span key={m.campo} className="flex flex-wrap items-center gap-1 text-[11px] text-foreground-muted">
              {m.campo}: <Mudanca de={m.de} para={m.para} />
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (a.tipo === 'excluir_agenda') {
    return (
      <div className="border-b border-border px-3 py-2.5 last:border-b-0">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 shrink-0 text-danger-fg" />
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">
            Excluir {a.item_tipo === 'tarefa' ? 'tarefa' : 'compromisso'} · {a.titulo}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1"><Chip>{a.quando}</Chip><Chip>sai também do Google</Chip></div>
      </div>
    );
  }
  if (a.tipo === 'alterar_cobranca' || a.tipo === 'alterar_despesa') {
    const ehCob = a.tipo === 'alterar_cobranca';
    const quem = ehCob ? a.cliente_nome : a.fornecedor;
    return (
      <div className="border-b border-border px-3 py-2.5 last:border-b-0">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">
            Alterar {ehCob ? 'cobrança' : 'despesa'} · {a.descricao}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {quem && <Chip>{quem}</Chip>}
          {a.novo_vencimento
            ? <Mudanca de={formatDate(a.vencimento_atual)} para={formatDate(a.novo_vencimento)} />
            : <Chip>vence {formatDate(a.vencimento_atual)}</Chip>}
          {a.novo_valor
            ? <Mudanca de={formatCurrency(a.valor_atual)} para={formatCurrency(a.novo_valor)} />
            : <Chip>{formatCurrency(a.valor_atual)}</Chip>}
          {ehCob && <Chip>Asaas + lançamento a receber</Chip>}
        </div>
      </div>
    );
  }
  if (a.tipo === 'cancelar_cobranca' || a.tipo === 'excluir_despesa') {
    const ehCob = a.tipo === 'cancelar_cobranca';
    const quem = ehCob ? a.cliente_nome : a.fornecedor;
    return (
      <div className="border-b border-border px-3 py-2.5 last:border-b-0">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 shrink-0 text-danger-fg" />
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">
            {ehCob ? 'Cancelar cobrança' : 'Excluir despesa'} · {a.descricao}
          </span>
          <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-danger-fg">{formatCurrency(a.valor)}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {quem && <Chip>{quem}</Chip>}
          <Chip>vence {formatDate(a.vencimento)}</Chip>
          {ehCob && a.de_assinatura && <Chip tom="warn">só este mês · a assinatura continua</Chip>}
        </div>
      </div>
    );
  }
  if (a.tipo === 'cliente') {
    return (
      <div className="border-b border-border px-3 py-2.5 last:border-b-0">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">Cadastrar {a.nome}</span>
          <Chip>{a.pessoa}</Chip>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {a.cpf_cnpj && <Chip>{a.pessoa === 'PJ' ? 'CNPJ' : 'CPF'} {formatCPFCNPJ(a.cpf_cnpj)}</Chip>}
          {a.email && <Chip>{a.email}</Chip>}
          {a.telefone && <Chip>{formatPhone(a.telefone)}</Chip>}
          {a.situacao && <Chip tom={a.situacao.toUpperCase() === 'ATIVA' ? 'info' : 'warn'}>Receita: {a.situacao}</Chip>}
        </div>
        {a.razao_social && a.razao_social !== a.nome && <p className="mt-1 text-[11.5px] text-foreground-muted">{a.razao_social}</p>}
        {a.endereco && <p className="mt-0.5 text-[11.5px] text-foreground-muted">{a.endereco}</p>}
        {a.existente && (
          <label className="mt-2 flex items-start gap-2 rounded-[12px] bg-warning-bg px-2.5 py-2 text-[12px] text-warning-fg">
            <input type="checkbox" className="mt-0.5" checked={usarExistente} onChange={(e) => setUsarExistente(e.target.checked)} />
            <span>Já existe <b>{a.existente.nome}</b>. Usar esse cadastro em vez de criar outro.</span>
          </label>
        )}
      </div>
    );
  }
  if (a.tipo === 'contrato') {
    return (
      <div className="border-b border-border px-3 py-2.5 last:border-b-0">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">Contrato · {a.descricao}</span>
          <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-[hsl(var(--success-fg))]">{formatCurrency(a.valor)}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Chip>{a.cliente_nome}{!a.cliente_id ? ' (novo)' : ''}</Chip>
          <Chip>{RECORRENCIA[a.recorrencia] || a.recorrencia}</Chip>
          {a.dia_vencimento && <Chip>vence dia {a.dia_vencimento}</Chip>}
          <Chip>de {formatDate(a.data_inicio)}{a.data_fim ? ` a ${formatDate(a.data_fim)}` : ''}</Chip>
          {a.cobrar_no_asaas && <Chip tom="info">Assinatura no Asaas · {FORMA_LABEL[a.forma] || a.forma}</Chip>}
        </div>
      </div>
    );
  }
  if (a.tipo !== 'cobranca') return null;
  return (
    <div className="border-b border-border px-3 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <Receipt className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">Cobrança · {a.descricao}</span>
        <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-[hsl(var(--success-fg))]">{formatCurrency(a.valor)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Chip>{a.cliente_nome}{!a.cliente_id ? ' (novo)' : ''}</Chip>
        <Chip>vence {formatDate(a.vencimento)}</Chip>
        {a.parcelas && a.parcelas.length > 1 && <Chip tom="info">{a.parcelas.length}× de {formatCurrency(a.parcelas[0].valor)}</Chip>}
        <Chip>{FORMA_LABEL[a.forma] || a.forma}</Chip>
        {a.conta_nome && <Chip>cai em {a.conta_nome}</Chip>}
      </div>
    </div>
  );
}

export function PropostaAcoes({ acoes, onResolved }: { acoes: AcaoIara[]; onResolved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAcao[] | null>(null);
  const [usarExistente, setUsarExistente] = useState<Record<string, boolean>>({});

  const confirmar = async () => {
    setSalvando(true);
    try {
      const r = await executarAcoes(acoes, usarExistente);
      setResultado(r);
      // Telas abertas (Início, Fluxo, Contas, Cobranças…) refletem na hora.
      if (r.some((x) => x.ok)) void queryClient.invalidateQueries();
      const falhas = r.filter((x) => !x.ok).length;
      toast(falhas
        ? { title: 'Parte não foi criada', description: `${r.length - falhas} de ${r.length} ok. Veja o motivo no card.`, variant: 'destructive' }
        : { title: 'Pronto!', description: 'Tudo certo.' });
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Tente de novo.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const copiar = async (link: string) => {
    try { await navigator.clipboard.writeText(link); toast({ title: 'Link copiado' }); } catch { /* sem permissão */ }
  };

  if (resultado) {
    return (
      <div className="mt-2.5 space-y-1.5">
        {resultado.map((r) => (
          <div key={r.id} className={cn('rounded-[14px] px-3 py-2 text-[12.5px]', r.ok ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg')}>
            <div className="flex items-start gap-2">
              {r.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span className="font-medium">{r.mensagem}</span>
            </div>
            {r.link && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-5">
                <button onClick={() => copiar(r.link!)} className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-foreground">
                  <Copy className="h-3 w-3" /> Copiar link de pagamento
                </button>
                <a href={r.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-foreground">
                  <ExternalLink className="h-3 w-3" /> Abrir
                </a>
              </div>
            )}
          </div>
        ))}
        {resultado.some((r) => r.ok) && acoes.some((a) => a.tipo.includes('cobranca')) && (
          <Link to="/cobrancas" className="inline-block px-1 text-[12px] font-semibold text-primary hover:underline">Ver em Cobranças →</Link>
        )}
      </div>
    );
  }

  const n = acoes.length;
  const soRemove = acoes.every((a) => a.tipo === 'cancelar_cobranca' || a.tipo === 'excluir_despesa' || a.tipo === 'excluir_receita' || a.tipo === 'excluir_agenda');
  const soWhats = acoes.every((a) => a.tipo === 'lembrete_whatsapp');
  const mexeAsaas = acoes.some((a) => ['cobranca', 'alterar_cobranca', 'cancelar_cobranca'].includes(a.tipo)
    || (a.tipo === 'contrato' && a.cobrar_no_asaas) || (a.tipo === 'dar_baixa' && a.via_asaas) || (a.tipo === 'alterar_contrato' && a.no_asaas));
  const aviso = soRemove ? 'Isso não dá para desfazer.'
    : acoes.every((a) => ['compromisso', 'tarefa', 'concluir_tarefa', 'alterar_agenda'].includes(a.tipo)) ? 'Vale também para o Google Agenda e Tarefas, se estiver conectado.'
    : soWhats ? 'A mensagem sai na hora pelo WhatsApp da empresa.'
    : mexeAsaas ? 'Cobranças e assinaturas mudam de verdade no Asaas.'
    : 'Muda direto no financeiro.';
  return (
    <div className="mt-2.5 rounded-[20px] border border-border bg-surface p-3">
      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Prévia · confira antes de confirmar</div>
      <div className="overflow-hidden rounded-[16px] border border-border">
        {acoes.map((a) => (
          <Item key={a.id} a={a} usarExistente={usarExistente[a.id] !== false}
            setUsarExistente={(v) => setUsarExistente((p) => ({ ...p, [a.id]: v }))} />
        ))}
      </div>
      <p className="px-1 pt-2.5 text-[11px] leading-[1.45] text-foreground-muted">
        {aviso} Para ajustar algo, é só me dizer (ex.: "muda o vencimento para dia 30").
      </p>
      <div className="mt-2.5 flex gap-2">
        <button onClick={onResolved} aria-label="Descartar" disabled={salvando}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50">
          <X className="h-4 w-4" />
        </button>
        <button onClick={confirmar} disabled={salvando}
          className={cn('flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors disabled:opacity-50',
            soRemove ? 'bg-danger-fg text-white hover:opacity-90' : 'bg-primary text-primary-foreground hover:bg-primary/90')}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : soRemove ? <Trash2 className="h-4 w-4" /> : soWhats ? <MessageCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {salvando ? 'Aplicando…' : soRemove ? (n === 1 ? 'Confirmar exclusão' : `Excluir ${n} itens`) : soWhats ? (n === 1 ? 'Enviar' : `Enviar ${n} mensagens`) : n === 1 ? 'Confirmar' : `Confirmar ${n} itens`}
        </button>
      </div>
    </div>
  );
}

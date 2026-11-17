// Card de confirmação das ações que a IARA preparou: cliente, contrato e cobrança.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, FileSignature, Loader2, Receipt, UserPlus, X, AlertTriangle } from 'lucide-react';
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

function Item({ a, usarExistente, setUsarExistente }: { a: AcaoIara; usarExistente: boolean; setUsarExistente: (v: boolean) => void }) {
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
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAcao[] | null>(null);
  const [usarExistente, setUsarExistente] = useState<Record<string, boolean>>({});

  const confirmar = async () => {
    setSalvando(true);
    try {
      const r = await executarAcoes(acoes, usarExistente);
      setResultado(r);
      const falhas = r.filter((x) => !x.ok).length;
      toast(falhas
        ? { title: 'Parte não foi criada', description: `${r.length - falhas} de ${r.length} ok. Veja o motivo no card.`, variant: 'destructive' }
        : { title: 'Pronto!', description: 'Tudo criado.' });
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
        {resultado.some((r) => r.ok) && (
          <Link to="/cobrancas" className="inline-block px-1 text-[12px] font-semibold text-primary hover:underline">Ver em Cobranças →</Link>
        )}
      </div>
    );
  }

  const n = acoes.length;
  return (
    <div className="mt-2.5 rounded-[20px] border border-border bg-surface p-3">
      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Prévia · confira antes de criar</div>
      <div className="overflow-hidden rounded-[16px] border border-border">
        {acoes.map((a) => (
          <Item key={a.id} a={a} usarExistente={usarExistente[a.id] !== false}
            setUsarExistente={(v) => setUsarExistente((p) => ({ ...p, [a.id]: v }))} />
        ))}
      </div>
      <p className="px-1 pt-2.5 text-[11px] leading-[1.45] text-foreground-muted">
        Cobrança e assinatura são criadas de verdade no Asaas. Para ajustar algo, é só me dizer (ex.: "muda o vencimento para dia 30").
      </p>
      <div className="mt-2.5 flex gap-2">
        <button onClick={onResolved} aria-label="Descartar" disabled={salvando}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50">
          <X className="h-4 w-4" />
        </button>
        <button onClick={confirmar} disabled={salvando}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {salvando ? 'Criando…' : n === 1 ? 'Confirmar' : `Confirmar ${n} itens`}
        </button>
      </div>
    </div>
  );
}

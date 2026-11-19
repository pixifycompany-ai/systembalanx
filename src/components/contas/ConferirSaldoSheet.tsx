// Conferir saldo com o banco: o usuário digita o saldo do extrato numa data; o
// sistema calcula o saldo dele na mesma data, mostra a diferença e as causas
// prováveis (lançamento não baixado, sem conta, em dobro, valor exato…).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle2, Loader2, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { ModalHeader, ModalFooter, ModalShell } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { ContaDB } from '@/hooks/useContas';
import {
  carregarConferencia, causasProvaveis, historicoConferencias, lancarAjuste, parseValorBR, saldoNaData, salvarConferencia,
  type Causa, type ConferenciaSalva, type Movimento,
} from '@/lib/conferenciaSaldo';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contas: ContaDB[];
  contaInicial?: string | null;
  onAjustado?: () => void;
}

interface Resultado { saldoSistema: number; saldoBanco: number; diferenca: number; causas: Causa[] }

export function ConferirSaldoSheet({ open, onOpenChange, contas, contaInicial, onAjustado }: Props) {
  const navigate = useNavigate();
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const [contaId, setContaId] = useState<string>('');
  const [data, setData] = useState(hoje);
  const [valorTxt, setValorTxt] = useState('');
  // Teclado numérico do celular não tem "−": o sinal vem deste botão.
  const [negativo, setNegativo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [historico, setHistorico] = useState<ConferenciaSalva[]>([]);
  const [ajustando, setAjustando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setContaId(contaInicial || contas[0]?.id || '');
    setData(hoje);
    setValorTxt('');
    setResultado(null);
  }, [open, contaInicial]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setResultado(null);
    if (open && contaId) historicoConferencias(contaId).then(setHistorico);
  }, [open, contaId]);

  const saldoBanco = (negativo ? -1 : 1) * Math.abs(parseValorBR(valorTxt));
  const conta = useMemo(() => contas.find((c) => c.id === contaId), [contas, contaId]);

  const conferir = async () => {
    if (!contaId || !Number.isFinite(saldoBanco)) return;
    setBusy(true);
    try {
      const d = await carregarConferencia(contaId, data);
      const saldoSistema = saldoNaData(d.saldoInicial, d.efetivados, data);
      const diferenca = Math.round((saldoBanco - saldoSistema) * 100) / 100;
      const daConta = d.efetivados.filter((m) => m.tabela !== 'transferencias' && m.data <= data && m.data >= format(new Date(new Date(data + 'T12:00:00').getTime() - 60 * 86400000), 'yyyy-MM-dd'));
      setResultado({ saldoSistema, saldoBanco, diferenca, causas: causasProvaveis(diferenca, d.naoBaixados, d.semConta, daConta) });
      await salvarConferencia(contaId, data, saldoBanco, saldoSistema).catch(() => {});
      historicoConferencias(contaId).then(setHistorico);
    } catch (e) {
      toast.error('Não foi possível conferir', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const ajustar = async () => {
    if (!resultado) return;
    const txt = `Lançar um ajuste de ${formatCurrency(Math.abs(resultado.diferenca))} (${resultado.diferenca > 0 ? 'entrada' : 'saída'}) em ${conta?.nome} no dia ${formatDate(data)}?\n\nUse só depois de conferir as causas: o ajuste faz o saldo bater, mas não corrige o lançamento errado.`;
    if (!window.confirm(txt)) return;
    setAjustando(true);
    try {
      await lancarAjuste(contaId, data, resultado.diferenca);
      toast.success('Ajuste lançado', { description: 'O saldo do sistema agora bate com o banco.' });
      onAjustado?.();
      await conferir();
    } catch (e) {
      toast.error('Não foi possível lançar o ajuste', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setAjustando(false);
    }
  };

  const abrir = (m: Movimento) => {
    onOpenChange(false);
    const tipo = m.tabela === 'receitas' ? 'entrada' : m.tabela === 'despesas' ? 'saida' : 'todas';
    navigate(`/fluxo-caixa?tipo=${tipo}&mes=${m.data.slice(0, 7)}&search=${encodeURIComponent(m.descricao.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)/g, ''))}`);
  };

  const bateu = resultado && Math.abs(resultado.diferenca) < 0.01;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[600px]')}>
        <SheetTitle className="sr-only">Conferir saldo com o banco</SheetTitle>
        <ModalShell>
        <ModalHeader eyebrow="Contas" title="Conferir com o banco" onClose={() => onOpenChange(false)} />
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <p className="text-[13px] text-foreground-muted">Abra o app do banco, veja o saldo e digite aqui. O BALANX mostra se bate com o que está lançado e o que pode explicar a diferença.</p>
          <div className="space-y-1.5">
            <Label>Conta</Label>
            <div className="flex flex-wrap gap-1.5">
              {contas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContaId(c.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors',
                    contaId === c.id ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground-muted hover:text-foreground',
                  )}
                >
                  <i className="h-2 w-2 rounded-full" style={{ background: c.cor }} />{c.nome}
                </button>
              ))}
            </div>
          </div>

          {conta && (
            <div className="flex items-center justify-between rounded-2xl bg-surface-2/70 px-4 py-3">
              <span className="text-[12.5px] text-foreground-muted">No BALANX hoje</span>
              <span className="font-heading text-[18px] font-semibold tabular-nums text-foreground">{formatCurrency(Number(conta.saldo_atual || 0))}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <DatePickerField label="Data do extrato" value={data} onChange={(d) => { setData(d); setResultado(null); }} />
            <div className="space-y-1.5">
              <Label htmlFor="saldo-banco">Saldo no banco</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setNegativo((v) => !v); setResultado(null); }}
                  aria-pressed={negativo}
                  aria-label={negativo ? 'Saldo negativo (toque para positivo)' : 'Saldo positivo (toque para negativo)'}
                  className={cn('h-11 w-11 shrink-0 rounded-xl border text-[18px] font-semibold tabular-nums transition-colors',
                    negativo ? 'border-danger-fg bg-danger-bg text-danger-fg' : 'border-border bg-surface-2 text-foreground-muted')}
                >
                  {negativo ? '−' : '+'}
                </button>
                <Input
                  id="saldo-banco"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorTxt}
                  onChange={(e) => { setValorTxt(e.target.value.replace(/-/g, '')); setResultado(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') conferir(); }}
                  className="h-11 tabular-nums"
                />
              </div>
            </div>
          </div>
          <p className="-mt-3 text-[11.5px] text-foreground-muted">
            Use o saldo do fim do dia no extrato. Conta no negativo? Toque no + para virar −.
          </p>


          {resultado && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-[20px] border border-border p-3.5">
                <Numero rotulo="No sistema" valor={resultado.saldoSistema} />
                <Numero rotulo="No banco" valor={resultado.saldoBanco} />
                <Numero rotulo="Diferença" valor={resultado.diferenca} destaque={bateu ? 'ok' : 'erro'} />
              </div>

              {bateu ? (
                <div className="flex items-center gap-2 rounded-2xl bg-success-bg px-3.5 py-3 text-[13px] font-medium text-success-fg">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Bateu. O saldo do sistema está igual ao do banco em {formatDate(data)}.
                </div>
              ) : (
                <>
                  <p className="text-[13px] text-foreground">
                    {resultado.diferenca > 0
                      ? `O banco tem ${formatCurrency(resultado.diferenca)} a mais que o sistema: falta alguma entrada ou sobra alguma saída no sistema.`
                      : `O banco tem ${formatCurrency(-resultado.diferenca)} a menos que o sistema: sobra alguma entrada ou falta alguma saída no sistema.`}
                  </p>
                  {resultado.causas.length ? (
                    <div className="space-y-3">
                      {resultado.causas.map((c, i) => <CausaCard key={i} causa={c} onAbrir={abrir} />)}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-foreground-muted">
                      Não achei uma causa provável. Compare o extrato com o fluxo de caixa desta conta, dia a dia, a partir da última conferência que bateu.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); navigate(`/fluxo-caixa?conta=${contaId}&base=efetivacao&mes=${data.slice(0, 7)}`); }}>
                      Ver lançamentos da conta
                    </Button>
                    <Button variant="ghost" size="sm" onClick={ajustar} disabled={ajustando}>
                      {ajustando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Lançar ajuste de {formatCurrency(Math.abs(resultado.diferenca))}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {historico.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Últimas conferências</p>
              <ul className="rounded-[16px] border border-border px-3.5">
                {historico.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-[12.5px] last:border-b-0">
                    <span className="text-foreground-muted">{formatDate(h.data)} · banco {formatCurrency(h.saldo_banco)}</span>
                    <span className={cn('font-semibold tabular-nums', Math.abs(h.diferenca) < 0.01 ? 'text-success-fg' : 'text-danger-fg')}>
                      {Math.abs(h.diferenca) < 0.01 ? 'Bateu' : formatCurrency(h.diferenca)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <ModalFooter>
          <button type="button" className={btn.outline} onClick={() => onOpenChange(false)}>Fechar</button>
          <button type="button" className={btn.primary} onClick={conferir} disabled={busy || !contaId || !Number.isFinite(saldoBanco)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />} Conferir
          </button>
        </ModalFooter>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: 'ok' | 'erro' }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-foreground-muted">{rotulo}</div>
      <div className={cn('truncate font-heading text-[15px] font-semibold tabular-nums', destaque === 'ok' ? 'text-success-fg' : destaque === 'erro' ? 'text-danger-fg' : 'text-foreground')}>
        {formatCurrency(valor)}
      </div>
    </div>
  );
}

function CausaCard({ causa, onAbrir }: { causa: Causa; onAbrir: (m: Movimento) => void }) {
  const forte = causa.tipo === 'exato' || causa.tipo === 'combinacao';
  return (
    <div className={cn('rounded-[18px] border p-3.5', forte ? 'border-warning-fg/40 bg-warning-bg' : 'border-border')}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13.5px] font-semibold text-foreground">{causa.titulo}</p>
        <span className="shrink-0 text-[12px] tabular-nums text-foreground-muted">{formatCurrency(causa.efeito)}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-foreground-muted">{causa.detalhe}</p>
      <ul className="mt-2">
        {causa.itens.slice(0, 8).map((m) => (
          <li key={`${m.tabela}-${m.id}`}>
            <button type="button" onClick={() => onAbrir(m)} className="flex w-full items-center justify-between gap-3 py-1.5 text-left text-[12.5px] hover:underline">
              <span className="min-w-0 truncate text-foreground">
                {formatDate(m.data)} · {m.descricao}{m.quem ? ` · ${m.quem}` : ''}
              </span>
              <span className={cn('shrink-0 tabular-nums', m.valor >= 0 ? 'text-success-fg' : 'text-danger-fg')}>{formatCurrency(m.valor)}</span>
            </button>
          </li>
        ))}
        {causa.itens.length > 8 && <li className="pt-1 text-[12px] text-foreground-muted">e mais {causa.itens.length - 8}…</li>}
      </ul>
    </div>
  );
}

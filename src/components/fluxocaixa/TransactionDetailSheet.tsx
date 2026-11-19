import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Copy, CreditCard, FileText, Pencil, Receipt, Repeat, Store, Trash2, User, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { formatCurrency } from '@/utils/formatters';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { NAVY_TONE } from '@/components/shared/navyTokens';
import { Bloco, ModalShell, NavyCard } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { AnexosDespesa } from './AnexosDespesa';
import { CobrancaDoLancamento } from './CobrancaDoLancamento';
import { EstenderRecorrencia } from './EstenderRecorrencia';
import { TipoIcone } from './TipoIcone';
import { hojeISO, serieDe, statusInfo } from './lancamento';

interface TransactionDetailSheetProps {
  transaction: TransacaoUnificada | null;
  contaNome?: string;
  contaCor?: string;
  categoriaNome?: string;
  categoriaCor?: string;
  clienteNome?: string;
  formaLabel?: string;
  onOpenChange: (o: boolean) => void;
  onEdit: (t: TransacaoUnificada) => void;
  onDelete: (t: TransacaoUnificada) => void;
  /** Quando presente, mostra "Gerar cobrança no Asaas" (receita em aberto). */
  onGerarCobranca?: (t: TransacaoUnificada) => void;
  /** Anexos da despesa mudaram (recarrega a lista). */
  onAnexosChange?: () => void;
  /** Fatura de cartão em aberto: abre o "Pagar fatura" (escolhe a conta que pagou). */
  onPagarFatura?: (t: TransacaoUnificada) => void;
  /** Vínculo com cobrança mudou (valor/vencimento do lançamento podem mudar). */
  onCobrancaChange?: () => void;
  /** Série recorrente ganhou lançamentos novos. */
  onSerieChange?: () => void;
  /** Dar baixa (recebido/pago) numa data. */
  onDarBaixa?: (t: TransacaoUnificada, dataISO: string) => Promise<void> | void;
  onDuplicate?: (t: TransacaoUnificada) => void;
  onRecibo?: (t: TransacaoUnificada) => void;
}

const dataBR = (iso?: string | null) => (iso ? format(parseISO(iso), 'dd/MM/yyyy') : '—');

export function TransactionDetailSheet({
  transaction: t,
  contaNome,
  contaCor,
  categoriaNome,
  categoriaCor,
  clienteNome,
  formaLabel,
  onOpenChange,
  onEdit,
  onDelete,
  onGerarCobranca,
  onAnexosChange,
  onPagarFatura,
  onCobrancaChange,
  onSerieChange,
  onDarBaixa,
  onDuplicate,
  onRecibo,
}: TransactionDetailSheetProps) {
  const [temCobranca, setTemCobranca] = useState(false);
  const [baixaData, setBaixaData] = useState(hojeISO());
  const [baixando, setBaixando] = useState(false);
  if (!t) return null;

  const ent = t.tipo === 'entrada';
  const ok = t.status === 'recebido' || t.status === 'pago';
  const st = statusInfo(t);
  const { base, serie } = serieDe(t.descricao);
  const quem = clienteNome || t.cliente?.nome || (t.fornecedor && !t.fornecedor.startsWith('[') ? t.fornecedor : undefined);
  const fechar = () => onOpenChange(false);

  const darBaixa = async () => {
    if (!onDarBaixa) return;
    setBaixando(true);
    try { await onDarBaixa(t, baixaData); fechar(); } finally { setBaixando(false); }
  };

  return (
    <Sheet open={!!t} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[880px]')}>
        <ModalShell>
          {/* topo */}
          <div className="flex items-start gap-3 border-b border-border bg-surface px-5 py-4 md:px-6">
            <TipoIcone t={t} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] text-foreground-muted">
                {ent ? 'Receita' : onPagarFatura ? 'Fatura do cartão' : 'Despesa'}
                {serie && <> · <Repeat className="mb-0.5 inline h-3 w-3" /> parcela {serie}</>}
              </p>
              <h2 className="truncate font-heading text-[22px] font-light tracking-[-0.02em] text-foreground">{base}</h2>
            </div>
            <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                {/* valor (navy com a marca d'água) */}
                <NavyCard>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[12.5px] text-white/70">
                      {ok ? `${ent ? 'Recebido' : 'Pago'} em ${dataBR(t.data_efetivacao || t.data_vencimento)}` : `Vence em ${dataBR(t.data_vencimento)}`}
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-2.5 py-1 text-[11.5px] font-medium">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ok ? NAVY_TONE.success : st.tom === 'atraso' ? NAVY_TONE.danger : NAVY_TONE.warning }} />
                      {st.txt}
                    </span>
                  </div>
                  <p className="mt-2 font-heading text-[34px] font-semibold tabular-nums tracking-[-0.03em]" style={{ color: ent ? NAVY_TONE.success : NAVY_TONE.danger }}>
                    {ent ? '+' : '−'}{formatCurrency(t.valor)}
                  </p>
                  {quem && (
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white/80">
                      {t.cliente?.nome || clienteNome ? <User className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}{quem}
                    </p>
                  )}
                </NavyCard>

                <Bloco title="Dados">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                    <div>
                      <dt className="text-foreground-muted">Categoria</dt>
                      <dd className="flex items-center gap-1.5 text-foreground">{categoriaCor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: categoriaCor }} />}<span className="truncate">{categoriaNome || 'Sem categoria'}</span></dd>
                    </div>
                    <div>
                      <dt className="text-foreground-muted">Conta</dt>
                      <dd className="flex items-center gap-1.5 text-foreground">{contaCor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: contaCor }} />}<span className="truncate">{contaNome || (onPagarFatura ? 'Escolhe ao pagar' : '—')}</span></dd>
                    </div>
                    <div><dt className="text-foreground-muted">{ent ? 'Cliente' : 'Fornecedor'}</dt><dd className="truncate text-foreground">{quem || '—'}</dd></div>
                    <div><dt className="text-foreground-muted">Forma</dt><dd className="truncate text-foreground">{formaLabel || '—'}</dd></div>
                    <div><dt className="text-foreground-muted">Competência</dt><dd className="text-foreground">{format(parseISO(t.data_competencia || t.data_vencimento), "MMM 'de' yyyy", { locale: ptBR })}</dd></div>
                    <div><dt className="text-foreground-muted">Vencimento</dt><dd className="text-foreground">{dataBR(t.data_vencimento)}</dd></div>
                    {ok && <div><dt className="text-foreground-muted">{ent ? 'Recebido em' : 'Pago em'}</dt><dd className="text-foreground">{dataBR(t.data_efetivacao)}</dd></div>}
                    {!ent && t.tipo_despesa && <div><dt className="text-foreground-muted">Tipo de despesa</dt><dd className="text-foreground">{t.tipo_despesa === 'fixa' ? 'Fixa' : 'Variável'}</dd></div>}
                  </dl>
                </Bloco>

                <EstenderRecorrencia key={`rec-${t.id}`} lancamento={t} onChange={onSerieChange} />
              </div>

              <div className="space-y-3">
                {/* ação principal: dar baixa ou pagar fatura */}
                {!ok && onPagarFatura && (
                  <Bloco title="Pagar fatura">
                    <p className="mb-3 text-[12.5px] text-foreground-muted">Escolha de qual conta saiu o dinheiro: o saldo dela é descontado e a fatura fecha como paga.</p>
                    <button type="button" onClick={() => { fechar(); onPagarFatura(t); }} className={`${btn.primary} w-full`}><CreditCard className="h-4 w-4" />Pagar fatura</button>
                  </Bloco>
                )}
                {!ok && !onPagarFatura && onDarBaixa && (
                  <Bloco title={ent ? 'Dar baixa no recebimento' : 'Dar baixa no pagamento'}>
                    <DatePickerField label={ent ? 'Recebido em' : 'Pago em'} value={baixaData} onChange={setBaixaData} />
                    {contaNome && <p className="mt-2 text-[12px] text-foreground-muted">{ent ? 'Entra em' : 'Sai de'} {contaNome}.</p>}
                    <button type="button" onClick={darBaixa} disabled={baixando} className={`${btn.primary} mt-3 w-full`}>
                      <CheckCircle2 className="h-4 w-4" />Marcar como {ent ? 'recebido' : 'pago'}
                    </button>
                    <p className="mt-2 text-center text-[11.5px] text-foreground-subtle">Teve juros, tarifa ou imposto? Informe em Editar.</p>
                  </Bloco>
                )}

                {t.tabela_origem === 'receitas' && (
                  <CobrancaDoLancamento key={t.id} receita={t} onChange={onCobrancaChange} onVinculo={setTemCobranca} />
                )}
                {onGerarCobranca && !temCobranca && (
                  <button type="button" onClick={() => { fechar(); onGerarCobranca(t); }} className={`${btn.outline} w-full`}>
                    <Receipt className="h-4 w-4" />Gerar cobrança no Asaas
                  </button>
                )}

                {/* boleto/nota da despesa a pagar: some sozinho quando ela é paga */}
                {t.tabela_origem === 'despesas' && !ok && !onPagarFatura && (
                  <AnexosDespesa key={t.id} despesaId={t.id} inicial={t.anexos ?? []} onChange={onAnexosChange} />
                )}

                {(onDuplicate || onRecibo) && (
                  <Bloco title="Mais ações">
                    <div className="grid grid-cols-2 gap-2">
                      {onDuplicate && (
                        <button type="button" onClick={() => { fechar(); onDuplicate(t); }} className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-left text-[13px] text-foreground hover:bg-surface-2"><Copy className="h-4 w-4" />Duplicar</button>
                      )}
                      {onRecibo && (
                        <button type="button" onClick={() => onRecibo(t)} className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-left text-[13px] text-foreground hover:bg-surface-2"><FileText className="h-4 w-4" />Gerar recibo</button>
                      )}
                    </div>
                  </Bloco>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3.5 pb-safe md:px-6">
            <button type="button" onClick={() => { fechar(); onDelete(t); }} className={btn.danger}><Trash2 className="h-4 w-4" />Excluir</button>
            <div className="flex gap-2">
              <button type="button" onClick={fechar} className={btn.outline}>Fechar</button>
              <button type="button" onClick={() => { fechar(); onEdit(t); }} className={btn.primary}><Pencil className="h-4 w-4" />Editar</button>
            </div>
          </div>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}

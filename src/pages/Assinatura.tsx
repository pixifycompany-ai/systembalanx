import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { PLAN } from '@/lib/plans';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW, NAVY_TONE } from '@/components/shared/navyTokens';
import { HexWatermark } from '@/components/shared/NavySurface';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export default function Assinatura() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeTenant, acessoAtivo, trialDias, role, refresh } = useTenant();
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('anual');
  const [cpfCnpj, setCpfCnpj] = useState('');
  // Mensalidade só por cartão (crédito/débito) ou PIX — boleto não é oferecido
  const [forma, setForma] = useState<'cartao' | 'pix'>('cartao');
  const [loading, setLoading] = useState(false);
  const [precoMensal, setPrecoMensal] = useState(PLAN.precoMensal);
  const [precoAnualParcela, setPrecoAnualParcela] = useState(PLAN.precoAnualParcela);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('plataforma_config').select('preco_mensal, preco_anual_parcela').eq('id', true).maybeSingle();
      if (data) {
        setPrecoMensal(Number(data.preco_mensal));
        setPrecoAnualParcela(Number(data.preco_anual_parcela));
      }
    })();
  }, []);
  const precoAnualTotal = precoAnualParcela * 12;

  const podeAssinar = role === 'owner' || role === 'admin';
  const cortesia = !!activeTenant?.cortesia;
  const assinaturaAtiva = activeTenant?.status_assinatura === 'ativa';
  const cicloAtual = (activeTenant?.ciclo as 'mensal' | 'anual' | null) ?? null;
  const descontoPct = precoMensal > precoAnualParcela ? Math.round((1 - precoAnualParcela / precoMensal) * 100) : 0;

  const chamarAsaas = async (novoCiclo: 'mensal' | 'anual', precisaCpf: boolean) => {
    if (!activeTenant) return;
    if (precisaCpf && !cpfCnpj.replace(/\D/g, '')) { toast({ title: 'Informe seu CPF ou CNPJ', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ tenant_id: activeTenant.id, ciclo: novoCiclo, cpfCnpj, ...(precisaCpf ? { forma } : {}) }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao assinar');
      await refresh();
      if (data.changed) {
        toast({ title: 'Plano alterado!', description: data.message || 'A mudança passa a valer no próximo vencimento.' });
      } else if (data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank');
        toast({ title: 'Quase lá!', description: forma === 'pix' ? 'Abrimos a fatura pra você pagar com PIX.' : 'Abrimos a fatura pra você pagar com cartão de crédito ou débito.' });
      } else {
        toast({ title: 'Assinatura criada', description: 'Acompanhe o pagamento no ASAAS.' });
      }
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao assinar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const assinar = () => chamarAsaas(ciclo, true);
  const mudarPlano = (novo: 'mensal' | 'anual') => chamarAsaas(novo, false);

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] md:pt-12">
        <button
          onClick={() => navigate('/')}
          className="mb-5 inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-[13px] font-medium text-foreground-muted transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Voltar
        </button>

        <MobilePageHeader
          className="mb-2 md:mb-2"
          eyebrow="Assinatura"
          title={<>Plano <span className="font-serif italic font-normal tracking-normal">{PLAN.nome}</span></>}
        />
        <p className="mb-5 text-[14px] leading-relaxed text-foreground-muted md:mb-6">{PLAN.descricao}</p>

        {cortesia ? (
          <div className="mb-5 flex items-center gap-3 rounded-[20px] border border-border bg-surface p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-success-bg text-success-fg">
              <CheckIcon className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-foreground">Acesso liberado (cortesia)</div>
              <div className="mt-0.5 text-[12.5px] text-foreground-muted">Tudo liberado. Bom trabalho!</div>
            </div>
          </div>
        ) : assinaturaAtiva ? (
          <div className="mb-5 space-y-3">
            <div className="flex items-center gap-3 rounded-[20px] border border-border bg-surface p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-success-bg text-success-fg">
                <CheckIcon className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-foreground">Assinatura ativa</div>
                <div className="mt-0.5 text-[12.5px] text-foreground-muted">
                  Plano {cicloAtual === 'anual' ? 'Anual' : 'Mensal'} · {cicloAtual === 'anual' ? `12× ${fmt(precoAnualParcela)}` : `${fmt(precoMensal)}/mês`}
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full bg-success-bg px-2.5 py-0.5 text-[11px] font-semibold text-success-fg">Ativa</span>
            </div>

            {podeAssinar && cicloAtual !== 'anual' && descontoPct > 0 && (
              <div
                className="relative isolate overflow-hidden rounded-[20px] p-5 text-white md:rounded-3xl"
                style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}
              >
                <HexWatermark />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">Recomendado</span>
                <div className="mt-1 text-[17px] font-semibold tracking-[-0.01em]">Economize {descontoPct}% no plano Anual</div>
                <div className="mb-4 mt-1 text-[13px] leading-relaxed text-white/75">
                  Pague 12× {fmt(precoAnualParcela)} em vez de {fmt(precoMensal)}/mês. A mudança começa no próximo vencimento — sem cobrança dupla.
                </div>
                <Button className="h-12 w-full rounded-full font-semibold" onClick={() => mudarPlano('anual')} disabled={loading}>
                  {loading ? 'Alterando…' : 'Mudar para Anual'}
                </Button>
              </div>
            )}

            {podeAssinar && cicloAtual === 'anual' && (
              <div className="rounded-[20px] border border-border bg-surface p-4">
                <div className="text-[14px] font-semibold text-foreground">Você está no melhor preço (Anual)</div>
                <button
                  onClick={() => mudarPlano('mensal')}
                  disabled={loading}
                  className="mt-1.5 text-[13px] font-medium text-foreground-muted underline underline-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Alterando…' : 'Prefiro voltar para o mensal'}
                </button>
              </div>
            )}

            {!podeAssinar && (
              <p className="py-1 text-center text-[13px] text-foreground-muted">Só o responsável (owner/admin) pode mudar o plano.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6">
            {typeof trialDias === 'number' && (
              <div className={cn('rounded-[14px] px-4 py-3 text-[13px] font-medium',
                acessoAtivo ? 'bg-info-bg text-info-fg' : 'bg-danger-bg text-danger-fg')}>
                {acessoAtivo ? `Você tem ${trialDias} dia(s) de teste restante(s).` : 'Seu período de teste terminou. Assine para continuar.'}
              </div>
            )}

            {/* Escolha do ciclo: Anual (recomendado, navy) e Mensal */}
            <section className="flex flex-col gap-2">
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Escolha o ciclo</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  onClick={() => setCiclo('anual')}
                  aria-pressed={ciclo === 'anual'}
                  className={cn(
                    'relative isolate overflow-hidden rounded-[20px] p-5 text-left text-white transition-shadow md:rounded-3xl',
                    ciclo === 'anual' && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                  style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}
                >
                  <HexWatermark />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">Anual · recomendado</span>
                    <RadioDot checked={ciclo === 'anual'} navy />
                  </div>
                  <div className="mt-3 font-heading text-[26px] font-semibold tabular-nums tracking-[-0.02em]">12× {fmt(precoAnualParcela)}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-white/75">
                    {fmt(precoAnualTotal)}/ano
                    {precoMensal > precoAnualParcela && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ color: NAVY_TONE.success, background: 'rgba(62,207,142,0.16)' }}
                      >
                        -{Math.round((1 - precoAnualParcela / precoMensal) * 100)}%
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setCiclo('mensal')}
                  aria-pressed={ciclo === 'mensal'}
                  className={cn(
                    'rounded-[20px] border bg-surface p-5 text-left transition-colors md:rounded-3xl',
                    ciclo === 'mensal' ? 'border-foreground ring-1 ring-foreground' : 'border-border hover:bg-surface-2',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Mensal</span>
                    <RadioDot checked={ciclo === 'mensal'} />
                  </div>
                  <div className="mt-3 font-heading text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">{fmt(precoMensal)}</div>
                  <div className="mt-0.5 text-[13px] text-foreground-muted">por mês</div>
                </button>
              </div>
            </section>

            {/* Features */}
            <SectionCard title="O que está incluso">
              <ul className="space-y-2.5">
                {PLAN.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px] text-foreground">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success-bg text-success-fg">
                      <CheckIcon className="h-3 w-3" strokeWidth={2.6} />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            {podeAssinar ? (
              <SectionCard title="Pagamento">
                <div className="mb-4 space-y-1.5">
                  <p className="text-[13px] font-semibold text-foreground">Forma de pagamento</p>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pagamento">
                    {([['cartao', 'Cartão', 'Crédito ou débito'], ['pix', 'PIX', 'Aprovação na hora']] as const).map(([v, t, d]) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={forma === v}
                        onClick={() => setForma(v)}
                        className={cn(
                          'flex flex-col items-start rounded-[16px] border px-4 py-3 text-left transition-colors',
                          forma === v ? 'border-foreground bg-surface ring-1 ring-foreground' : 'border-border bg-surface-2 hover:border-border-strong',
                        )}
                      >
                        <span className="text-[14px] font-semibold text-foreground">{t}</span>
                        <span className="text-[12px] text-foreground-muted">{d}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4 space-y-1.5">
                  <Label htmlFor="cpf-cnpj" className="text-[13px] font-semibold text-foreground">CPF ou CNPJ (para a cobrança)</Label>
                  <Input
                    id="cpf-cnpj"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    className="h-12 rounded-[14px] bg-surface-2"
                  />
                </div>
                <Button className="h-12 w-full rounded-full text-[15px] font-semibold" onClick={assinar} disabled={loading}>
                  {loading ? 'Gerando cobrança…' : `Assinar — ${ciclo === 'anual' ? `12× ${fmt(precoAnualParcela)}` : fmt(precoMensal)}`}
                </Button>
                <p className="mt-3 text-center text-[12px] text-foreground-muted">Pagamento por cartão de crédito/débito ou PIX, pelo ASAAS. Cancele quando quiser.</p>
              </SectionCard>
            ) : (
              <p className="py-4 text-center text-[14px] text-foreground-muted">Peça ao responsável (owner/admin) da conta para assinar.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Indicador de seleção (rádio) do cartão de plano. */
function RadioDot({ checked, navy }: { checked: boolean; navy?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2',
        navy
          ? checked ? 'border-white bg-white text-[#0B1226]' : 'border-white/40'
          : checked ? 'border-foreground bg-foreground text-background' : 'border-border-strong',
      )}
    >
      {checked && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}

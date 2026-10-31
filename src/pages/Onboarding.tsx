import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeftIcon, ArrowUpTrayIcon, CheckIcon, MicrophoneIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { PixifyLogo } from '@/components/shared/PixifyLogo';
import { BalanxLoader } from '@/components/shared/BalanxLoader';
import { Sparkle } from '@/components/shared/Sparkle';
import { HexWatermark } from '@/components/shared/NavySurface';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW, NAVY_TONE } from '@/components/shared/navyTokens';

// tenants e a RPC de criação ainda não estão nos tipos gerados — client "solto" só p/ eles.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Perfil = 'autonomo' | 'empresa' | 'agencia' | 'pessoal';
type Step = 'negocio' | 'conta' | 'meta' | 'pronto';

const PERFIS: { id: Perfil; titulo: string; desc: string }[] = [
  { id: 'autonomo', titulo: 'Autônomo', desc: 'Freelancer, consultor, prestador' },
  { id: 'empresa', titulo: 'Pequena empresa', desc: 'Comércio, serviços, PME' },
  { id: 'agencia', titulo: 'Agência', desc: 'Clientes, contratos e MRR' },
  { id: 'pessoal', titulo: 'Finanças pessoais', desc: 'Contas, cartões e gastos' },
];

const BANCOS: { nome: string; cor: string }[] = [
  { nome: 'Nubank', cor: '#820AD1' },
  { nome: 'Itaú', cor: '#EC7000' },
  { nome: 'Inter', cor: '#FF7A00' },
  { nome: 'Banco do Brasil', cor: '#F8C300' },
  { nome: 'Bradesco', cor: '#CC092F' },
  { nome: 'Caixa', cor: '#005CA9' },
  { nome: 'Santander', cor: '#EC0000' },
  { nome: 'C6 Bank', cor: '#242424' },
  { nome: 'Mercado Pago', cor: '#00A6E0' },
  { nome: 'Outro', cor: '#3B82F6' },
];

const SUGESTOES_META = [5000, 10000, 20000, 50000];

/** Valor em centavos digitado como no app do banco (cada dígito empurra da direita). */
function MoneyInput({ cents, onChange, id, ariaLabel }: { cents: number; onChange: (c: number) => void; id?: string; ariaLabel?: string }) {
  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      inputMode="numeric"
      value={formatCurrency(cents / 100)}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D/g, '').slice(0, 12);
        onChange(Number(digitos || '0'));
      }}
      className="h-14 rounded-[16px] bg-surface-2 font-heading text-[22px] font-semibold tabular-nums tracking-[-0.02em]"
    />
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { memberships, activeTenant, loading: tenantLoading, refresh } = useTenant();

  const nomePessoa = useMemo(() => {
    const meta = (user?.user_metadata as { nome?: string } | undefined)?.nome;
    try { return meta || localStorage.getItem('onboarding:nome') || ''; } catch { return meta || ''; }
  }, [user]);
  const primeiroNome = nomePessoa.split(' ')[0] || '';

  const [step, setStep] = useState<Step>('negocio');
  const [salvando, setSalvando] = useState(false);
  // 1) negócio
  const [negocio, setNegocio] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('autonomo');
  // 2) conta
  const [banco, setBanco] = useState<string>('Nubank');
  const [saldoCents, setSaldoCents] = useState(0);
  const [contaCriada, setContaCriada] = useState<{ nome: string; saldo: number } | null>(null);
  // 3) meta
  const [metaCents, setMetaCents] = useState(0);
  const [metaSalva, setMetaSalva] = useState<number | null>(null);

  const pessoal = perfil === 'pessoal';
  const passos: Step[] = pessoal ? ['negocio', 'conta', 'pronto'] : ['negocio', 'conta', 'meta', 'pronto'];
  const idx = passos.indexOf(step);
  const mesNome = format(new Date(), 'MMMM', { locale: ptBR });
  const bancoSel = BANCOS.find((b) => b.nome === banco) ?? BANCOS[BANCOS.length - 1];
  const nomeConta = banco === 'Outro' ? 'Conta principal' : banco;
  const fimTrial = activeTenant?.trial_ends_at ? new Date(activeTenant.trial_ends_at) : addDays(new Date(), 14);

  // Quem volta pro onboarding já com conta criada: começa com o nome atual.
  useEffect(() => {
    if (activeTenant?.nome && !negocio) setNegocio(activeTenant.nome);
  }, [activeTenant?.nome]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || tenantLoading) return <BalanxLoader />;
  if (!user) return <Navigate to="/criar-conta" replace />;

  const voltar = () => idx > 0 && setStep(passos[idx - 1]);
  const avancar = () => setStep(passos[Math.min(idx + 1, passos.length - 1)]);

  // ---- Passo 1: cria (ou atualiza) a conta/tenant com o nome do negócio ----
  const salvarNegocio = async () => {
    const nome = negocio.trim() || (pessoal ? (nomePessoa || 'Minha conta') : `Negócio de ${primeiroNome || 'você'}`);
    const tipo = pessoal ? 'pessoal' : 'agencia';
    setSalvando(true);
    try {
      if (memberships.length === 0) {
        const { error } = await sb.rpc('create_tenant_with_owner', { p_nome: nome, p_tipo: tipo });
        if (error) throw error;
      } else if (activeTenant) {
        await sb.from('tenants').update({ nome, tipo }).eq('id', activeTenant.id);
      }
      await refresh();
      avancar();
    } catch (e) {
      toast({ title: 'Não foi possível criar sua conta', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  // ---- Passo 2: primeira conta bancária ----
  const salvarConta = async () => {
    if (contaCriada) { avancar(); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.from('contas').insert({
        user_id: user.id,
        nome: nomeConta,
        banco: banco === 'Outro' ? null : banco,
        tipo: 'corrente',
        saldo_inicial: saldoCents / 100,
        cor: bancoSel.cor,
        ativa: true,
      });
      if (error) throw error;
      setContaCriada({ nome: nomeConta, saldo: saldoCents / 100 });
      avancar();
    } catch (e) {
      toast({ title: 'Não foi possível criar a conta', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  // ---- Passo 3: meta de faturamento do mês ----
  const salvarMeta = async () => {
    if (metaCents <= 0) { avancar(); return; }
    setSalvando(true);
    try {
      const periodo = format(new Date(), 'yyyy-MM');
      const { error } = await supabase.from('metas').insert({ user_id: user.id, tipo: 'faturamento', periodo, valor_meta: metaCents / 100 });
      if (error) throw error;
      setMetaSalva(metaCents / 100);
      avancar();
    } catch (e) {
      toast({ title: 'Não foi possível salvar a meta', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const concluir = (destino = '/') => {
    try { localStorage.removeItem('onboarding:nome'); } catch { /* ignore */ }
    navigate(destino, { replace: true });
  };

  const titulo = 'text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground md:text-[38px]';
  const serif = 'font-serif italic font-normal tracking-normal';

  return (
    <div className="min-h-[100dvh] w-full bg-background md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* ================= Coluna do passo ================= */}
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] md:px-10 md:py-10">
        <header className="mb-8 flex items-center justify-between gap-3">
          {idx > 0 && step !== 'pronto' ? (
            <button type="button" onClick={voltar} aria-label="Voltar"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-foreground hover:bg-surface-2">
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
          ) : (
            <PixifyLogo size="sm" />
          )}
          {step !== 'pronto' && (
            <div className="flex items-center gap-3" aria-label={`Passo ${idx + 1} de ${passos.length - 1}`}>
              <div className="flex gap-1.5">
                {passos.slice(0, -1).map((p, i) => (
                  <span key={p} className={cn('h-1.5 rounded-full transition-all duration-300', i === idx ? 'w-8 bg-foreground' : i < idx ? 'w-4 bg-foreground' : 'w-4 bg-surface-3')} />
                ))}
              </div>
              <span className="text-[12px] font-semibold tabular-nums text-foreground-muted">{idx + 1}/{passos.length - 1}</span>
            </div>
          )}
        </header>

        {/* ---------- 1. Negócio ---------- */}
        {step === 'negocio' && (
          <section className="flex flex-1 flex-col animate-fade-in">
            <p className="mb-2 text-[14px] text-foreground-muted">{primeiroNome ? `Olá, ${primeiroNome}! ` : ''}Vamos montar seu BALANX.</p>
            <h1 className={titulo}>Para quem é <span className={serif}>esta conta?</span></h1>

            <div className="mt-7 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Perfil">
              {PERFIS.map((p) => {
                const sel = perfil === p.id;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={sel} onClick={() => setPerfil(p.id)}
                    className={cn('relative flex min-h-[92px] flex-col justify-end rounded-[18px] border p-3.5 text-left transition-colors',
                      sel ? 'border-foreground bg-surface ring-1 ring-foreground' : 'border-border bg-surface hover:bg-surface-2')}>
                    {sel && (
                      <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background">
                        <CheckIcon className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                    <span className="text-[15px] font-semibold text-foreground">{p.titulo}</span>
                    <span className="mt-0.5 text-[12.5px] leading-snug text-foreground-muted">{p.desc}</span>
                  </button>
                );
              })}
            </div>

            <label htmlFor="negocio" className="mb-1.5 mt-6 text-[13px] font-semibold text-foreground">
              {pessoal ? 'Nome da conta' : 'Nome do seu negócio'}
            </label>
            <Input id="negocio" value={negocio} onChange={(e) => setNegocio(e.target.value)} maxLength={60}
              placeholder={pessoal ? (nomePessoa || 'Minha conta') : 'Ex.: Estúdio Aurora'}
              className="h-12 rounded-[14px] bg-surface-2" autoFocus />
            <p className="mt-1.5 text-[12px] text-foreground-muted">Aparece no menu e nos relatórios. Dá pra mudar depois.</p>

            <div className="flex-1" />
            <Button className="mt-8 h-12 w-full text-[15px]" onClick={salvarNegocio} disabled={salvando}>
              {salvando ? 'Criando sua conta…' : 'Continuar'}
            </Button>
          </section>
        )}

        {/* ---------- 2. Conta bancária ---------- */}
        {step === 'conta' && (
          <section className="flex flex-1 flex-col animate-fade-in">
            <p className="mb-2 text-[14px] text-foreground-muted">Sua primeira conta</p>
            <h1 className={titulo}>Onde está <span className={serif}>seu dinheiro?</span></h1>

            <p className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Banco</p>
            <div className="flex flex-wrap gap-2">
              {BANCOS.map((b) => {
                const sel = banco === b.nome;
                return (
                  <button key={b.nome} type="button" onClick={() => setBanco(b.nome)} aria-pressed={sel}
                    className={cn('inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                      sel ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground hover:bg-surface-2')}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.cor }} aria-hidden />
                    {b.nome}
                  </button>
                );
              })}
            </div>

            <label htmlFor="saldo" className="mb-1.5 mt-6 text-[13px] font-semibold text-foreground">Saldo atual</label>
            <MoneyInput id="saldo" cents={saldoCents} onChange={setSaldoCents} />
            <p className="mt-1.5 text-[12px] text-foreground-muted">O valor que aparece hoje no app do banco. Cartões e outras contas você adiciona depois.</p>

            <div className="flex-1" />
            <Button className="mt-8 h-12 w-full text-[15px]" onClick={salvarConta} disabled={salvando}>
              {salvando ? 'Criando conta…' : contaCriada ? 'Continuar' : `Criar conta ${nomeConta}`}
            </Button>
            {!contaCriada && (
              <button type="button" onClick={avancar} className="mt-2 h-11 text-[13px] font-medium text-foreground-muted hover:text-foreground">
                Fazer depois
              </button>
            )}
          </section>
        )}

        {/* ---------- 3. Meta ---------- */}
        {step === 'meta' && (
          <section className="flex flex-1 flex-col animate-fade-in">
            <p className="mb-2 text-[14px] text-foreground-muted">Sua meta</p>
            <h1 className={titulo}>Quanto quer faturar <span className={serif}>em {mesNome}?</span></h1>
            <p className="mt-3 text-[14px] leading-relaxed text-foreground-muted">A Home mostra o progresso do mês e a IARA te avisa se o ritmo cair.</p>

            <label htmlFor="meta" className="mb-1.5 mt-7 text-[13px] font-semibold text-foreground">Meta de faturamento</label>
            <MoneyInput id="meta" cents={metaCents} onChange={setMetaCents} />
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGESTOES_META.map((v) => {
                const sel = metaCents === v * 100;
                return (
                  <button key={v} type="button" onClick={() => setMetaCents(v * 100)} aria-pressed={sel}
                    className={cn('h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                      sel ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground hover:bg-surface-2')}>
                    {formatCurrency(v).replace(',00', '')}
                  </button>
                );
              })}
            </div>

            <div className="flex-1" />
            <Button className="mt-8 h-12 w-full text-[15px]" onClick={salvarMeta} disabled={salvando}>
              {salvando ? 'Salvando…' : metaCents > 0 ? 'Definir meta' : 'Continuar sem meta'}
            </Button>
          </section>
        )}

        {/* ---------- 4. Pronto ---------- */}
        {step === 'pronto' && (
          <section className="flex flex-1 flex-col animate-fade-in">
            <div className="relative isolate overflow-hidden rounded-[24px] p-6 text-white" style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}>
              <HexWatermark />
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
                <CheckIcon className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <h1 className="mt-5 text-[30px] font-semibold leading-[1.08] tracking-[-0.035em]">
                Tudo pronto{primeiroNome ? `, ${primeiroNome}` : ''}<span className={serif}>!</span>
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-white/75">
                Seu teste grátis vai até <b className="font-semibold text-white">{format(fimTrial, "d 'de' MMMM", { locale: ptBR })}</b>, com tudo liberado.
              </p>
            </div>

            <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">O que já está configurado</p>
            <div className="rounded-[20px] border border-border bg-surface px-4">
              <Resumo ok titulo={activeTenant?.nome || negocio || 'Sua conta'} desc={PERFIS.find((p) => p.id === perfil)?.titulo ?? ''} />
              <Resumo ok={!!contaCriada} titulo={contaCriada ? contaCriada.nome : 'Conta bancária'}
                desc={contaCriada ? `Saldo inicial ${formatCurrency(contaCriada.saldo)}` : 'Adicione em Contas quando quiser'} />
              {!pessoal && (
                <Resumo ok={metaSalva != null} titulo="Meta do mês"
                  desc={metaSalva != null ? `${formatCurrency(metaSalva)} em ${mesNome}` : 'Defina na Home quando quiser'} />
              )}
            </div>

            <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Comece por aqui</p>
            <div className="grid grid-cols-3 gap-2">
              <Atalho icone={<ArrowUpTrayIcon className="h-5 w-5" />} titulo="Importar extrato" onClick={() => concluir('/fluxo-caixa?action=importar')} />
              <Atalho icone={<MicrophoneIcon className="h-5 w-5" />} titulo="Lançar por voz" onClick={() => concluir('/lancar-voz')} />
              <Atalho icone={<Sparkle className="h-5 w-5" />} titulo="Falar com a IARA" onClick={() => concluir('/iara')} />
            </div>

            <div className="flex-1" />
            <Button className="mt-8 h-12 w-full text-[15px]" onClick={() => concluir('/')}>Ir para o início</Button>
          </section>
        )}
      </div>

      {/* ================= Prévia ao vivo (desktop) ================= */}
      <aside className="sticky top-0 hidden h-[100dvh] p-4 md:block">
        <div className="relative flex h-full flex-col justify-center overflow-hidden rounded-[32px] bg-surface-2 px-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Prévia da sua Home</p>
          <div className="w-full max-w-[400px] rounded-[28px] border border-border bg-background p-5 shadow-[0_30px_60px_-30px_hsl(224_55%_10%/0.35)]">
            <div className="flex items-center justify-between">
              <span className="truncate rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-semibold text-foreground">
                {negocio.trim() || (pessoal ? 'Minha conta' : 'Seu negócio')}
              </span>
              <span className="text-[12px] text-foreground-muted">{format(new Date(), "d 'de' MMM", { locale: ptBR })}</span>
            </div>
            <p className="mt-4 text-[13px] text-foreground-muted">Boa {new Date().getHours() < 12 ? 'dia' : new Date().getHours() < 18 ? 'tarde' : 'noite'},</p>
            <p className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground">
              <span className={serif}>{primeiroNome || 'você'}</span>
            </p>

            <div className="relative isolate mt-4 overflow-hidden rounded-[22px] p-5 text-white" style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}>
              <HexWatermark className="h-32 -right-6 -bottom-8" />
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-white/70">Saldo consolidado</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: bancoSel.cor }} />{nomeConta}
                </span>
              </div>
              <p className="mt-2 font-heading text-[30px] font-semibold tabular-nums tracking-[-0.04em]">{formatCurrency(saldoCents / 100)}</p>
              <div className="mt-3 flex justify-between text-[12px]">
                <span style={{ color: NAVY_TONE.success }}>Receitas R$ 0,00</span>
                <span style={{ color: NAVY_TONE.danger }}>Despesas R$ 0,00</span>
              </div>
            </div>

            {!pessoal && (
              <div className="mt-3 rounded-[20px] border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-foreground-muted">Meta de {mesNome}</span>
                  <span className="font-heading text-[15px] font-semibold tabular-nums text-foreground">{metaCents > 0 ? formatCurrency(metaCents / 100) : '—'}</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full w-[3%] rounded-full bg-primary" /></div>
              </div>
            )}
          </div>
          <p className="mt-5 max-w-[400px] text-[13px] leading-relaxed text-foreground-muted">
            A prévia muda conforme você responde. Depois é só lançar receitas e despesas, ou importar um extrato.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Resumo({ ok, titulo, desc }: { ok: boolean; titulo: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3.5 last:border-b-0">
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', ok ? 'bg-success-bg text-success-fg' : 'bg-surface-2 text-foreground-subtle')}>
        {ok ? <CheckIcon className="h-4 w-4" strokeWidth={2.6} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-foreground">{titulo}</p>
        <p className="truncate text-[12.5px] text-foreground-muted">{desc}</p>
      </div>
    </div>
  );
}

function Atalho({ icone, titulo, onClick }: { icone: React.ReactNode; titulo: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-[18px] border border-border bg-surface p-3.5 text-left transition-colors hover:bg-surface-2">
      <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-surface-2 text-foreground">{icone}</span>
      <span className="text-[13px] font-semibold leading-tight text-foreground">{titulo}</span>
    </button>
  );
}

// Tela da IARA (visual novo, mesmo estilo da landing): antes da 1ª pergunta, uma
// "vitrine" com o retrato da IARA, o título e atalhos; na conversa, as respostas dela
// sem balão (texto corrido, como um chat de IA) e as perguntas em pílula escura.
// Só apresentação: quem usa (pages/Iara.tsx) passa estado e ações.
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import {
  ArrowUp, CalendarClock, FileText, HandCoins, Loader2, Mic, Paperclip, Receipt, RotateCcw,
  ShieldCheck, TrendingUp, UserPlus, X, AlertTriangle, ChevronLeft, Square,
} from 'lucide-react';
import { Sparkle } from '@/components/shared/Sparkle';
import { OlhoValores } from '@/components/shared/OlhoValores';
import { useIsMobile } from '@/hooks/use-mobile';
import { IaraMarkdown } from '@/components/iara/IaraMarkdown';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/useFinancialAdvisor';
// Retrato quadrado recortado no rosto (a foto larga do banner cortava o rosto no círculo).
import fotoIara from '@/assets/brand/iara-avatar.webp';

const ATALHOS: { texto: string; sub: string; icon: ReactNode }[] = [
  { texto: 'O que tenho a pagar essa semana?', sub: 'Vencimentos por dia', icon: <CalendarClock className="h-4 w-4" /> },
  { texto: 'Quanto falta receber esse mês?', sub: 'No prazo e em atraso', icon: <HandCoins className="h-4 w-4" /> },
  { texto: 'Gerar uma cobrança', sub: 'Pix, boleto ou cartão', icon: <Receipt className="h-4 w-4" /> },
  { texto: 'Cadastrar cliente pelo CNPJ', sub: 'Dados da Receita', icon: <UserPlus className="h-4 w-4" /> },
  { texto: 'Quanto posso retirar de lucro?', sub: 'Sem apertar o caixa', icon: <TrendingUp className="h-4 w-4" /> },
  { texto: 'Quais despesas estão acima da média?', sub: 'Comparando com os últimos meses', icon: <AlertTriangle className="h-4 w-4" /> },
];

export interface IaraTelaProps {
  messages: ChatMessage[];
  isLoading: boolean;
  input: string;
  setInput: (v: string) => void;
  onSubmit: (texto: string) => void;
  onLimpar: () => void;
  onVoltar?: () => void;
  anexos: { nome: string }[];
  onRemoverAnexo: (i: number) => void;
  onAnexar: () => void;
  fileInput?: ReactNode;
  listening: boolean;
  transcribing: boolean;
  onMic: () => void;
  /** Descarta a gravação em andamento (sem transcrever). */
  onCancelarGravacao?: () => void;
  scrollRef?: RefObject<HTMLDivElement>;
  /** Cards de confirmação (ações / lançamentos) de uma mensagem da IARA. */
  renderPropostas?: (m: ChatMessage) => ReactNode;
  /** Tela de onde a pessoa veio (ex.: "DRE · 2026"): a IARA responde sobre esses números. */
  contexto?: string | null;
  onLimparContexto?: () => void;
}

/** Fundo "aurora" (o mesmo da landing), discreto e nos dois temas. */
function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      <div className="absolute -left-[10%] -top-[20%] h-[70%] w-[60%] rounded-full bg-primary/15 blur-3xl dark:bg-primary/20" />
      <div className="absolute -right-[10%] top-[5%] h-[60%] w-[55%] rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/15" />
      <div className="absolute bottom-[-25%] left-[25%] h-[60%] w-[60%] rounded-full bg-sky-300/15 blur-3xl dark:bg-sky-500/10" />
    </div>
  );
}

/** Cronômetro da gravação (mm:ss). */
function useCronometro(ativo: boolean) {
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    if (!ativo) { setSeg(0); return; }
    const t0 = Date.now();
    const id = window.setInterval(() => setSeg(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [ativo]);
  return `${String(Math.floor(seg / 60)).padStart(1, '0')}:${String(seg % 60).padStart(2, '0')}`;
}

/** Onda do microfone (barras animadas). */
function Onda({ barras = 28 }: { barras?: number }) {
  return (
    <div className="iara-onda flex h-7 min-w-0 flex-1 items-center justify-center gap-[3px] overflow-hidden" aria-hidden>
      {Array.from({ length: barras }, (_, i) => (
        <i key={i} style={{ animationDelay: `${(i * 97) % 900}ms`, ['--h' as string]: `${30 + ((i * 37) % 70)}%` }} />
      ))}
    </div>
  );
}

/** IARA pensando: estrela girando + etapas que se revezam com brilho. */
const ETAPAS = ['Entendendo o pedido…', 'Lendo seus lançamentos…', 'Conferindo contas e clientes…', 'Calculando…', 'Montando a resposta…'];
function Pensando() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => Math.min(x + 1, ETAPAS.length - 1)), 1400);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <span className="relative grid h-7 w-7 shrink-0 place-items-center">
        <span className="absolute inset-0 animate-[spin_2.4s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,transparent,hsl(var(--primary)/.6),rgba(167,139,250,.6),transparent)]" />
        <span className="absolute inset-[2px] rounded-full bg-background" />
        <Sparkle className="relative h-3.5 w-3.5 animate-pulse text-primary" />
      </span>
      <span key={i} className="iara-brilho animate-in fade-in slide-in-from-bottom-1 text-[14px] duration-300">{ETAPAS[i]}</span>
    </div>
  );
}

function Composer(p: IaraTelaProps & { grande?: boolean }) {
  const mobile = useIsMobile();
  const tempo = useCronometro(p.listening);
  // ---- Gravando: o campo vira a barra de voz ----
  if (p.listening || p.transcribing) {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-full border px-2 shadow-[0_18px_50px_-28px_rgba(37,52,120,0.55)] backdrop-blur',
        p.listening ? 'border-danger-fg/30 bg-surface/95' : 'border-primary/30 bg-surface/95',
        p.grande ? 'h-[64px]' : 'h-[56px]',
      )}>
        {p.listening ? (
          <>
            <button type="button" onClick={p.onCancelarGravacao} aria-label="Cancelar gravação"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-2 hover:text-foreground">
              <X className="h-[18px] w-[18px]" />
            </button>
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] tabular-nums text-danger-fg">
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger-fg" /> {tempo}
            </span>
            <Onda />
            <button type="button" onClick={p.onMic} aria-label="Parar e transcrever"
              className={cn('flex shrink-0 items-center justify-center rounded-full bg-danger-fg text-white transition-transform active:scale-95', p.grande ? 'h-11 w-11' : 'h-10 w-10')}>
              <Square className="h-4 w-4 fill-current" />
            </button>
          </>
        ) : (
          <>
            <span className="grid h-10 w-10 shrink-0 place-items-center text-primary"><Loader2 className="h-[18px] w-[18px] animate-spin" /></span>
            <span className="iara-brilho flex-1 text-[14.5px]">Transcrevendo seu áudio…</span>
          </>
        )}
      </div>
    );
  }
  const podeEnviar = !p.isLoading && (!!p.input.trim() || p.anexos.length > 0);
  return (
    <form onSubmit={(e) => { e.preventDefault(); p.onSubmit(p.input); }} className="w-full">
      {p.anexos.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {p.anexos.map((a, i) => (
            <span key={`${a.nome}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] text-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{a.nome}</span>
              <button type="button" aria-label={`Remover ${a.nome}`} onClick={() => p.onRemoverAnexo(i)} className="text-foreground-muted hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {p.fileInput}
      <div className={cn(
        'flex items-center gap-1 rounded-full border border-border/70 bg-surface/95 pl-2 pr-1.5 shadow-[0_18px_50px_-28px_rgba(37,52,120,0.55)] backdrop-blur transition-shadow focus-within:border-primary/40 focus-within:shadow-[0_18px_50px_-24px_rgba(37,99,235,0.55)]',
        p.grande ? 'h-[64px]' : 'h-[56px]',
      )}>
        <button type="button" onClick={p.onAnexar} disabled={p.isLoading || p.anexos.length >= 3}
          aria-label="Anexar imagem ou PDF" title="Anexar imagem ou PDF (cartão CNPJ, contrato…)"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50">
          <Paperclip className="h-[18px] w-[18px]" />
        </button>
        <label htmlFor="iara-input" className="sr-only">Pergunte à IARA</label>
        <input id="iara-input" value={p.input} onChange={(e) => p.setInput(e.target.value)} disabled={p.isLoading}
          placeholder={p.grande ? (mobile ? 'Pergunte à IARA' : 'Pergunte, cobre um cliente, mande um CNPJ…') : 'Continue a conversa…'}
          className={cn('h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-foreground-muted', p.grande ? 'text-[16px]' : 'text-[15px]')} />
        <button type="button" onClick={p.onMic} disabled={p.transcribing}
          aria-label={p.listening ? 'Parar e transcrever' : 'Falar'}
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95',
            p.listening ? 'animate-pulse bg-danger-bg text-danger-fg' : 'text-foreground-muted hover:bg-surface-2 hover:text-foreground',
            p.transcribing && 'opacity-60')}>
          {p.transcribing ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Mic className="h-[18px] w-[18px]" />}
        </button>
        <button type="submit" disabled={!podeEnviar} aria-label="Enviar"
          className={cn('flex shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all active:scale-95 disabled:opacity-35',
            p.grande ? 'h-11 w-11' : 'h-10 w-10')}>
          {p.isLoading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ArrowUp className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </form>
  );
}

export function IaraTela(p: IaraTelaProps) {
  const conversa = p.messages.filter((m) => m.role === 'user').length > 0;
  const lastIsUser = p.messages[p.messages.length - 1]?.role === 'user';

  return (
    <div className="fixed inset-x-0 top-0 bottom-0 z-30 flex flex-col bg-background px-3 pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] md:static md:z-auto md:mx-auto md:-mb-8 md:-mt-4 md:h-[calc(100dvh-3.5rem)] md:w-full md:max-w-[1180px] md:bg-transparent md:px-0 md:py-4">
      {/* Barra do topo: discreta */}
      <div className={cn('mb-2 flex w-full items-center gap-2.5', conversa && 'mx-auto max-w-[920px]')}>
        {p.onVoltar && (
          <button onClick={p.onVoltar} aria-label="Voltar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted hover:text-foreground md:hidden">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className={cn('flex min-w-0 flex-1 items-center gap-2.5 transition-opacity', conversa ? 'opacity-100' : 'opacity-0 md:opacity-0')}>
          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/25">
            <img src={fotoIara} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="font-heading text-[15px] text-foreground">IARA</p>
            <p className="flex items-center gap-1.5 text-[11.5px] text-foreground-muted"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success-fg))]" />online</p>
          </div>
        </div>
        <OlhoValores className="h-9 w-9 shrink-0 rounded-full text-foreground-muted hover:text-foreground [&_svg]:h-4 [&_svg]:w-4" />
        {conversa && (
          <button onClick={p.onLimpar} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-[12.5px] text-foreground-muted hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Nova conversa
          </button>
        )}
      </div>

      {!conversa ? (
        /* ---------- Vitrine (antes da 1ª pergunta) ---------- */
        <section className="relative isolate flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[32px] px-4 py-8 md:px-10">
          <Aurora className="rounded-[32px]" />
          {/* m-auto centraliza sem cortar o topo quando o conteúdo é maior que a tela */}
          <div className="m-auto flex w-full flex-col items-center">
          <div className="relative mb-5">
            {/* Anel de luz: gira devagar; mais rápido e maior enquanto ela ouve ou pensa */}
            <span className={cn('absolute inset-[-10px] rounded-full bg-[conic-gradient(from_0deg,hsl(var(--primary)/.0),hsl(var(--primary)/.45),rgba(167,139,250,.45),hsl(var(--primary)/.0))] blur-md transition-transform duration-500',
              p.listening || p.isLoading ? 'scale-125 animate-[spin_2.5s_linear_infinite]' : 'animate-[spin_14s_linear_infinite]')} />
            <span className="relative block h-20 w-20 overflow-hidden rounded-full ring-4 ring-background md:h-24 md:w-24">
              <img src={fotoIara} alt="IARA" className="h-full w-full object-cover" />
            </span>
            <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-foreground text-background ring-4 ring-background">
              <Sparkle className="h-3.5 w-3.5" />
            </span>
          </div>
          <h1 className="text-center font-heading text-[34px] font-light leading-[1.05] tracking-[-0.04em] text-foreground md:text-[46px]">
            Pergunte qualquer coisa <span className="font-serif italic tracking-normal">à IARA</span>
          </h1>
          <div className="mt-3 flex flex-col items-center gap-1 text-center text-[13.5px] leading-snug text-foreground-muted">
            <p>Lê seus lançamentos, contas e clientes.</p>
            <p className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success-fg))]" />
              Nada sai do BALANX.
            </p>
          </div>
          <div className="mt-7 w-full max-w-[760px]"><Composer {...p} grande /></div>
          <div className="mt-6 grid w-full max-w-[960px] grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ATALHOS.map((a) => (
              <button key={a.texto} onClick={() => p.onSubmit(a.texto)} disabled={p.isLoading}
                className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-surface/80 px-3.5 py-3 text-left backdrop-blur transition-colors hover:border-border hover:bg-surface disabled:opacity-50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{a.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] text-foreground">{a.texto}</span>
                  <span className="block truncate text-[11.5px] text-foreground-muted">{a.sub}</span>
                </span>
              </button>
            ))}
          </div>
          </div>
        </section>
      ) : (
        /* ---------- Conversa ---------- */
        <section className="relative isolate flex min-h-0 flex-1 flex-col">
          <div ref={p.scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-6 pt-3 [-webkit-overflow-scrolling:touch] md:px-2">
            <div className="mx-auto w-full max-w-[920px] space-y-6">
            {p.messages.map((m, idx) => {
              if (m.role === 'assistant' && idx === 0 && p.messages.length > 1 && !m.acoes?.length && !m.lancamentos?.length) return null; // saudação inicial some
              return m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[82%] rounded-[22px] rounded-br-md bg-foreground px-4 py-2.5 text-[14.5px] leading-[1.5] text-background">
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.anexos?.map((n) => (
                      <span key={n} className="mt-1.5 flex items-center gap-1.5 text-[12px] opacity-80"><FileText className="h-3.5 w-3.5" />{n}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Sparkle className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] leading-[1.65] text-foreground"><IaraMarkdown content={m.content || '…'} /></div>
                    {p.renderPropostas?.(m)}
                  </div>
                </div>
              );
            })}
            {p.isLoading && lastIsUser && <Pensando />}
            </div>
          </div>
          {/* Atalhos + campo, presos embaixo com um véu de gradiente */}
          <div className="relative mx-auto w-full max-w-[920px] pt-2">
            <div aria-hidden className="pointer-events-none absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
            {p.contexto && (
              <div className="mb-2 flex">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-[12.5px] text-primary">
                  <Sparkle className="h-3 w-3 shrink-0" /><span className="truncate">Sobre: {p.contexto}</span>
                  {p.onLimparContexto && (
                    <button type="button" onClick={p.onLimparContexto} aria-label="Parar de falar sobre esta tela" className="grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-primary/15"><X className="h-3.5 w-3.5" /></button>
                  )}
                </span>
              </div>
            )}
            <div className="mb-2 flex gap-2 overflow-x-auto scrollbar-hide">
              {ATALHOS.map((a) => (
                <button key={a.texto} onClick={() => p.onSubmit(a.texto)} disabled={p.isLoading}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12.5px] text-foreground-muted transition-colors hover:text-foreground disabled:opacity-50">
                  <span className="text-primary">{a.icon}</span>{a.texto}
                </button>
              ))}
            </div>
            <Composer {...p} />
          </div>
        </section>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Send, ChevronLeft, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useFinancialAdvisor, type PeriodOption } from '@/hooks/useFinancialAdvisor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PERIOD_LABELS: Record<PeriodOption, string> = {
  current_month: 'Mês atual',
  last_3_months: 'Últimos 3 meses',
  last_6_months: 'Últimos 6 meses',
  current_year: 'Ano atual',
};

const SUGESTOES = [
  'Analise meu fluxo de caixa',
  'Quanto posso retirar de lucro?',
  'Quais despesas estão acima da média?',
  'Projeção para os próximos 3 meses',
  'Receitas atrasadas',
];

export default function Iara() {
  const navigate = useNavigate();
  const { messages, isLoading, period, setPeriod, sendMessage, clearChat } = useFinancialAdvisor();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const submit = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage(text);
    setInput('');
  };

  const lastIsUser = messages[messages.length - 1]?.role === 'user';

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 md:px-4 py-3 border-b border-border/60">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface border border-border/60 text-foreground-muted hover:text-foreground md:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0 shadow-[0_8px_18px_-6px_hsl(var(--primary)/0.6)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold leading-tight">IARA</div>
          <div className="text-[11px] text-foreground-muted">Assistente financeiro</div>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-auto h-9 text-xs gap-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={clearChat}
          aria-label="Limpar conversa"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Privacidade */}
      <div className="mx-3 md:mx-4 mt-3 flex items-center gap-2 text-[11px] text-foreground-subtle bg-surface/60 border border-border/50 rounded-xl px-3 py-2">
        <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--warning))] shrink-0" />
        Lê seus lançamentos, contas e clientes — nada sai do BALANX.
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex gap-2.5 items-end', m.role === 'user' && 'flex-row-reverse')}>
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                m.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-foreground-muted',
              )}
            >
              {m.role === 'assistant' ? <Sparkles className="h-4 w-4" /> : 'Você'}
            </div>
            <div
              className={cn(
                'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-md',
                m.role === 'assistant'
                  ? 'bg-surface/80 backdrop-blur-xl border border-border/60 rounded-bl-md text-foreground'
                  : 'bg-primary text-primary-foreground rounded-br-md',
              )}
            >
              {m.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{m.content || '…'}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && lastIsUser && (
          <div className="flex gap-2.5 items-end">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Sugestões */}
      <div className="flex gap-2 overflow-x-auto px-3 md:px-4 py-2 scrollbar-hide">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={isLoading}
            className="shrink-0 text-xs font-medium text-foreground bg-surface/70 border border-border/60 rounded-full px-3 py-1.5 hover:border-border-strong transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className="flex items-center gap-2 px-3 md:px-4 pt-1 pb-[calc(1rem+4.5rem)] md:pb-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre seu caixa, metas, clientes…"
          disabled={isLoading}
          className="flex-1 h-11 rounded-2xl bg-surface/70 backdrop-blur-xl border border-border/60 px-4 text-sm text-foreground placeholder:text-foreground-subtle outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Enviar"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_-6px_hsl(var(--primary)/0.5)] active:scale-95 transition-transform disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  );
}

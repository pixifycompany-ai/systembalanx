import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Send, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { useFinancialAdvisor, type PeriodOption } from '@/hooks/useFinancialAdvisor';
import { IaraMarkdown } from '@/components/iara/IaraMarkdown';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { value: 'current_month', label: 'Mês atual' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
  { value: 'last_6_months', label: 'Últimos 6 meses' },
  { value: 'current_year', label: 'Ano atual' },
] as const;

const QUICK_SUGGESTIONS = [
  'Analise meu fluxo de caixa',
  'Quanto posso retirar de lucro?',
  'Quais despesas estão acima da média?',
  'Projeção para os próximos 3 meses',
  'Receitas atrasadas',
];

interface AIAdvisorWidgetProps {
  /** Ocupa a altura do contêiner (ex.: ao lado do gráfico na Home). */
  fill?: boolean;
  className?: string;
}

export function AIAdvisorWidget({ fill = false, className }: AIAdvisorWidgetProps = {}) {
  const { messages, isLoading, period, setPeriod, sendMessage, clearChat } = useFinancialAdvisor();
  // Sugestões só até a primeira pergunta — depois a conversa ganha o espaço.
  const semPerguntas = !messages.some((m) => m.role === 'user');
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleSuggestion = (suggestion: string) => {
    if (!isLoading) {
      sendMessage(suggestion);
    }
  };

  return (
    <Card className={cn('overflow-hidden', fill && 'flex h-full flex-col', className)}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </span>
          IARA · Assistente
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
            <SelectTrigger className={cn('h-8 text-xs', fill ? 'w-[132px]' : 'w-[160px]')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat} title="Limpar conversa">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn('p-0', fill && 'flex min-h-0 flex-1 flex-col')}>
        <ScrollArea className={cn('px-4', fill ? 'min-h-[200px] flex-1' : 'h-[300px]')} ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' && "flex-row-reverse")}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  msg.role === 'assistant' ? "bg-primary/10 text-primary" : "bg-muted"
                )}>
                  {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className={cn(
                  "rounded-lg px-3 py-2 max-w-[85%] text-sm",
                  msg.role === 'assistant' ? "bg-muted" : "bg-primary text-primary-foreground"
                )}>
                  {msg.role === 'assistant' ? (
                    <IaraMarkdown content={msg.content || '...'} />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick suggestions */}
        {semPerguntas && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {(fill ? QUICK_SUGGESTIONS.slice(0, 3) : QUICK_SUGGESTIONS).map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleSuggestion(suggestion)}
                disabled={isLoading}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2 p-4 pt-2 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte à IARA…"
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Send, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { useFinancialAdvisor, type PeriodOption } from '@/hooks/useFinancialAdvisor';
import ReactMarkdown from 'react-markdown';
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

export function AIAdvisorWidget() {
  const { messages, isLoading, period, setPeriod, sendMessage, clearChat } = useFinancialAdvisor();
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
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistente Financeiro IA
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
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
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] px-4" ref={scrollRef}>
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
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content || '...'}</ReactMarkdown>
                    </div>
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
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SUGGESTIONS.map((suggestion) => (
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

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2 p-4 pt-2 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta..."
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

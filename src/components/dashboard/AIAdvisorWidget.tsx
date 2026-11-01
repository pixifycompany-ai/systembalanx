import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Send, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { useFinancialAdvisor } from '@/hooks/useFinancialAdvisor';
import { IaraMarkdown } from '@/components/iara/IaraMarkdown';
import { cn } from '@/lib/utils';
import { HexWatermark } from '@/components/shared/NavySurface';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW } from '@/components/shared/navyTokens';

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
  /** 'navy' = bloco de destaque da Home (texto branco); 'surface' = cartão normal. */
  variant?: 'surface' | 'navy';
  className?: string;
}

export function AIAdvisorWidget({ fill = false, variant = 'surface', className }: AIAdvisorWidgetProps = {}) {
  const { messages, isLoading, sendMessage, clearChat } = useFinancialAdvisor();
  // Sugestões só até a primeira pergunta — depois a conversa ganha o espaço.
  const semPerguntas = !messages.some((m) => m.role === 'user');
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const navy = variant === 'navy';

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
    <section
      className={cn(
        'relative isolate flex flex-col overflow-hidden rounded-[20px] md:rounded-3xl',
        navy ? 'text-white' : 'border border-border bg-surface text-foreground',
        fill && 'h-full',
        className,
      )}
      style={navy ? { background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW } : undefined}
    >
      {navy && <HexWatermark className="-right-12 -top-10 bottom-auto h-56" />}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-5 md:px-6 md:pt-6">
        <h2 className="flex min-w-0 items-center gap-2.5 text-[16px] font-semibold tracking-[-0.01em] md:text-[17px]">
          <span
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full',
              navy ? 'bg-white/10 text-white' : 'bg-info-bg text-info-fg',
            )}
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="truncate">IARA · Assistente</span>
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', navy && 'text-white/80 hover:bg-white/10 hover:text-white')}
            onClick={clearChat}
            title="Limpar conversa"
            aria-label="Limpar conversa"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className={cn('flex flex-col', fill && 'min-h-0 flex-1')}>
        <ScrollArea className={cn('px-5 md:px-6', fill ? 'min-h-[200px] flex-1' : 'h-[300px]')} ref={scrollRef}>
          <div className="space-y-3 py-3">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
                  {!navy && (
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        isUser ? 'bg-surface-2 text-foreground-muted' : 'bg-info-bg text-info-fg',
                      )}
                    >
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] px-3.5 py-2.5 text-sm',
                      isUser
                        ? 'rounded-[16px_16px_4px_16px] bg-primary text-primary-foreground'
                        : navy
                          ? 'rounded-[16px_16px_16px_4px] bg-white/[0.07] text-white'
                          : 'rounded-[16px_16px_16px_4px] bg-surface-2 text-foreground',
                    )}
                  >
                    {isUser ? (
                      <p>{msg.content}</p>
                    ) : (
                      <IaraMarkdown
                        content={msg.content || '...'}
                        tone={navy ? 'navy' : 'default'}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2.5">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    navy ? 'bg-white/10 text-white' : 'bg-info-bg text-info-fg',
                  )}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Sugestões rápidas */}
        {semPerguntas && (
          <div className="px-5 pb-2 md:px-6">
            <div className="flex flex-wrap gap-1.5">
              {(fill ? QUICK_SUGGESTIONS.slice(0, 3) : QUICK_SUGGESTIONS).map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 text-xs font-medium',
                    navy && 'border-white/15 bg-white/[0.07] text-white hover:bg-white/15 hover:text-white',
                  )}
                  onClick={() => handleSuggestion(suggestion)}
                  disabled={isLoading}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Campo de pergunta */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 pt-2 md:px-6 md:pb-6">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5',
              navy ? 'bg-white/[0.07]' : 'border border-border bg-surface-2',
            )}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte à IARA…"
              aria-label="Pergunte à IARA"
              disabled={isLoading}
              className={cn(
                'h-9 flex-1 rounded-none border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0',
                navy && 'text-white placeholder:text-white/70',
              )}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar"
              disabled={isLoading || !input.trim()}
              className={cn('h-10 w-10', navy && 'bg-white text-[hsl(var(--navy-card))] hover:bg-white/90')}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

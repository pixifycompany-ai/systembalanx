import { useState, useCallback } from 'react';
import type { ItemLancamento } from '@/lib/lancarItens';

/** Lançamento proposto pela IARA (card de confirmação). Superset de ItemLancamento. */
export type PropostaLancamento = ItemLancamento & { cliente_nome?: string | null };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Prévia de lançamentos para a pessoa confirmar e criar. */
  lancamentos?: PropostaLancamento[];
}

interface UseFinancialAdvisorReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  /** Remove o card de prévia de uma mensagem (após criar/cancelar). */
  clearLancamentos: (messageId: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financial-advisor`;

export function useFinancialAdvisor(): UseFinancialAdvisorReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Sou a IARA. Tenho acesso a todos os seus lançamentos, contas e clientes — é só perguntar e dizer o período, se quiser (ex.: "mês passado", "últimos 3 meses", "de 10/09 a 20/10"). Sem período, uso o mês atual.',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    let assistantContent = '';
    const assistantMessageId = `assistant-${Date.now()}`;

    // Add empty assistant message that we'll update
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      // Get auth token
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Você precisa estar logado para usar o assistente.');
      }

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: messages
            .filter(m => m.id !== 'welcome')
            .map(m => ({ role: m.role, content: m.content }))
            .concat([{ role: 'user', content: content.trim() }]),
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
        }
        if (response.status === 402) {
          throw new Error('Créditos esgotados. Adicione mais créditos para continuar.');
        }
        const errorText = await response.text();
        throw new Error(errorText || 'Erro ao processar sua mensagem.');
      }

      if (!response.body) {
        throw new Error('Resposta vazia do servidor.');
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process line by line
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, content: assistantContent } : m
              ));
            }
            if (Array.isArray(parsed.lancamentos) && parsed.lancamentos.length) {
              const lancs = parsed.lancamentos as PropostaLancamento[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, lancamentos: lancs } : m
              ));
            }
          } catch {
            // Incomplete JSON, put back in buffer
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, content: assistantContent } : m
              ));
            }
            if (Array.isArray(parsed.lancamentos) && parsed.lancamentos.length) {
              const lancs = parsed.lancamentos as PropostaLancamento[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, lancamentos: lancs } : m
              ));
            }
          } catch { /* ignore */ }
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      // Update assistant message with error
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId 
          ? { ...m, content: `${errorMessage}` }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearLancamentos = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, lancamentos: undefined } : m
    ));
  }, []);

  const clearChat = useCallback(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Sou a IARA. Tenho acesso a todos os seus lançamentos, contas e clientes — é só perguntar e dizer o período, se quiser (ex.: "mês passado", "últimos 3 meses", "de 10/09 a 20/10"). Sem período, uso o mês atual.',
      timestamp: new Date(),
    }]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    clearLancamentos,
  };
}

import { useState, useCallback } from 'react';
import type { ItemLancamento } from '@/lib/lancarItens';
import type { AcaoIara } from '@/lib/acoesIara';
import type { ArquivoIara } from '@/lib/arquivoIara';

export interface LancamentoLista { id: string; tipo: 'receita' | 'despesa'; cartao: boolean; data: string | null; quem: string; descricao: string; valor: number; status: string }
export interface LinhaConf { id?: string; data: string | null; descricao: string; valor: number; parcela?: string | null; categoria?: string; possivel_duplicado?: boolean; proxima_fatura?: boolean; sugerir_excluir?: boolean }
export interface GrupoConf { tipo: 'somado_no_balanx' | 'dividido_no_balanx'; valor: number; balanx: LinhaConf[]; arquivo: LinhaConf[] }
export interface ConferenciaFatura {
  cartao: string; fatura_id?: string; fatura_balanx: string; vencimento: string; fechamento: string; agrupados?: GrupoConf[];
  total_pdf_impresso: number | null; total_pdf: number; total_balanx: number; diferenca: number;
  faltam: LinhaConf[]; sobram: LinhaConf[];
  valores_diferentes: { no_pdf: LinhaConf; no_balanx: LinhaConf; diferenca: number }[];
  conferidos: number; soma_faltam: number; soma_dif: number; soma_sobram: number;
  aviso_fechamento: string | null; aviso_leitura?: string | null; lancar_preparado: number;
}
export interface DocumentoIara { acao: 'guardado' | 'encontrado'; id: string; nome: string; url?: string; resumo?: string | null; data?: string; mime?: string | null }

/** Lançamento proposto pela IARA (card de confirmação). Superset de ItemLancamento. */
export type PropostaLancamento = ItemLancamento & { cliente_nome?: string | null };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Prévia de lançamentos para a pessoa confirmar e criar. */
  lancamentos?: PropostaLancamento[];
  /** Prévia de cliente / contrato / cobrança para confirmar. */
  acoes?: AcaoIara[];
  /** Painéis de conexão para mostrar na conversa (whatsapp, google, atalho_iphone…). */
  conexoes?: string[];
  /** O que a IARA guardou ou apagou da memória nesta resposta. */
  memorias?: { acao: 'anotei' | 'esqueci'; texto: string }[];
  /** Documentos guardados ou encontrados pela IARA (com link para abrir). */
  documentos?: DocumentoIara[];
  /** Arquivos (PDF/Excel) gerados pela IARA para baixar. */
  arquivos?: ArquivoIara[];
  /** Quadro da conferência da fatura (números da ferramenta, sem passar pelo texto da IARA). */
  conferencias?: ConferenciaFatura[];
  /** Lançamentos listados pela IARA, com botão para abrir no Fluxo de caixa. */
  lista_lancamentos?: LancamentoLista[];
  /** Nomes dos arquivos enviados junto (mensagem do usuário). */
  anexos?: string[];
}

/** O que a pessoa está vendo quando chama a IARA de outra tela (relatório, indicador…).
 *  Vai junto da pergunta para a IARA explicar exatamente aqueles números. */
export interface ContextoTela {
  tela: string;
  titulo: string;
  periodo?: string;
  dados?: unknown;
}

/** Arquivo anexado a uma pergunta (imagem ou PDF), lido pela IARA. */
export interface AnexoIara {
  nome: string;
  tipo: string;
  base64: string;
}

interface UseFinancialAdvisorReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, anexos?: AnexoIara[], contextoTela?: ContextoTela | null) => Promise<void>;
  clearChat: () => void;
  /** Remove o card de prévia de uma mensagem (após criar/cancelar). */
  clearLancamentos: (messageId: string) => void;
  /** Remove o card de ações (cliente/contrato/cobrança) de uma mensagem. */
  clearAcoes: (messageId: string) => void;
  /** Mostra no chat uma conversa feita fora dele (ex.: pelo Atalho do iPhone), com os cards a confirmar. */
  adicionarConversa: (c: ConversaExterna) => void;
}

export interface ConversaExterna {
  id: string;
  pergunta: string;
  resposta: string;
  acoes?: AcaoIara[] | null;
  lancamentos?: PropostaLancamento[] | null;
  quando: Date;
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

  const sendMessage = useCallback(async (content: string, anexos: AnexoIara[] = [], contextoTela: ContextoTela | null = null) => {
    if (!content.trim() && !anexos.length) return;
    const texto = content.trim() || 'Leia o arquivo anexado.';

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: texto,
      timestamp: new Date(),
      anexos: anexos.length ? anexos.map((a) => a.nome) : undefined,
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
            // Arquivos de perguntas antigas não vão de novo: só o aviso de que existiram.
            .map(m => ({ role: m.role, content: m.anexos?.length ? `${m.content}\n[anexo enviado antes: ${m.anexos.join(', ')}]` : m.content }))
            .concat([{ role: 'user', content: texto }]),
          anexos,
          ...(contextoTela ? { contexto_tela: contextoTela } : {}),
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
            if (Array.isArray(parsed.acoes) && parsed.acoes.length) {
              const acoes = parsed.acoes as AcaoIara[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, acoes } : m
              ));
            }
            if (Array.isArray(parsed.conexoes) && parsed.conexoes.length) {
              const conexoes = parsed.conexoes as string[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, conexoes } : m
              ));
            }
            if (Array.isArray(parsed.memorias) && parsed.memorias.length) {
              const memorias = parsed.memorias as ChatMessage['memorias'];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, memorias } : m
              ));
            }
            if (Array.isArray(parsed.documentos) && parsed.documentos.length) {
              const documentos = parsed.documentos as DocumentoIara[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, documentos } : m
              ));
            }
            if (Array.isArray(parsed.arquivos) && parsed.arquivos.length) {
              const arquivos = parsed.arquivos as ArquivoIara[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, arquivos } : m
              ));
            }
            if (Array.isArray(parsed.conferencias) && parsed.conferencias.length) {
              const conferencias = parsed.conferencias as ConferenciaFatura[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, conferencias } : m
              ));
            }
            if (Array.isArray(parsed.lista_lancamentos) && parsed.lista_lancamentos.length) {
              const lista_lancamentos = parsed.lista_lancamentos as LancamentoLista[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, lista_lancamentos } : m
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
            if (Array.isArray(parsed.acoes) && parsed.acoes.length) {
              const acoes = parsed.acoes as AcaoIara[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, acoes } : m
              ));
            }
            if (Array.isArray(parsed.conexoes) && parsed.conexoes.length) {
              const conexoes = parsed.conexoes as string[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, conexoes } : m
              ));
            }
            if (Array.isArray(parsed.memorias) && parsed.memorias.length) {
              const memorias = parsed.memorias as ChatMessage['memorias'];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, memorias } : m
              ));
            }
            if (Array.isArray(parsed.documentos) && parsed.documentos.length) {
              const documentos = parsed.documentos as DocumentoIara[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, documentos } : m
              ));
            }
            if (Array.isArray(parsed.arquivos) && parsed.arquivos.length) {
              const arquivos = parsed.arquivos as ArquivoIara[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, arquivos } : m
              ));
            }
            if (Array.isArray(parsed.conferencias) && parsed.conferencias.length) {
              const conferencias = parsed.conferencias as ConferenciaFatura[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, conferencias } : m
              ));
            }
            if (Array.isArray(parsed.lista_lancamentos) && parsed.lista_lancamentos.length) {
              const lista_lancamentos = parsed.lista_lancamentos as LancamentoLista[];
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, lista_lancamentos } : m
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

  const clearAcoes = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, acoes: undefined } : m
    ));
  }, []);

  const adicionarConversa = useCallback((c: ConversaExterna) => {
    setMessages(prev => prev.some(m => m.id === `ext-a-${c.id}`) ? prev : [
      ...prev,
      { id: `ext-u-${c.id}`, role: 'user', content: c.pergunta, timestamp: c.quando },
      { id: `ext-a-${c.id}`, role: 'assistant', content: c.resposta, timestamp: c.quando,
        acoes: c.acoes?.length ? c.acoes : undefined, lancamentos: c.lancamentos?.length ? c.lancamentos : undefined },
    ]);
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
    clearAcoes,
    adicionarConversa,
  };
}

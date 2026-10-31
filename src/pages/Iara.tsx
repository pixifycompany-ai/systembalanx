import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ChevronLeft, RefreshCw, ShieldCheck, Loader2, Mic } from 'lucide-react';
import { UserIcon } from '@heroicons/react/24/solid';
import { Sparkle } from '@/components/shared/Sparkle';
import { IaraMarkdown } from '@/components/iara/IaraMarkdown';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFinancialAdvisor, type PeriodOption } from '@/hooks/useFinancialAdvisor';
import { PropostaLancamentos } from '@/components/iara/PropostaLancamentos';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
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
  'O que tenho a pagar essa semana?',
  'Quanto recebi do dia 1 ao 15?',
  'O que vence hoje e amanhã?',
  'Quanto posso retirar de lucro?',
  'Quais despesas estão acima da média?',
  'Contas a receber no resto do mês',
  'Receitas atrasadas',
];

export default function Iara() {
  const navigate = useNavigate();
  const { messages, isLoading, period, setPeriod, sendMessage, clearChat, clearLancamentos } = useFinancialAdvisor();
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false); // gravando
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Grava o áudio (MediaRecorder) e transcreve no servidor (Whisper). A Web Speech
  // API do navegador não é confiável no iOS — este caminho funciona no iPhone.
  const transcrever = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const type = blob.type || 'audio/webm';
      const ext = type.includes('mp4') || type.includes('m4a') ? 'm4a'
        : type.includes('ogg') ? 'ogg'
        : type.includes('wav') ? 'wav'
        : type.includes('mpeg') ? 'mp3'
        : 'webm';
      const fd = new FormData();
      fd.append('file', blob, `audio.${ext}`);
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcrever`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: fd,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Falha na transcrição');
      const text = (data.text || '').trim();
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
      else toast({ title: 'Não entendi o áudio', description: 'Tente falar de novo, mais perto do microfone.' });
    } catch (e) {
      toast({ title: 'Erro ao transcrever', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setTranscribing(false);
    }
  };

  const startRec = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast({ title: 'Sem suporte a gravação', description: 'Seu navegador não permite gravar áudio aqui.', variant: 'destructive' });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast({ title: 'Microfone bloqueado', description: 'Permita o acesso ao microfone nas configurações do navegador.', variant: 'destructive' });
      return;
    }
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
      if (blob.size > 0) await transcrever(blob);
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setListening(true);
  };

  const stopRec = () => {
    try { mediaRecorderRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  const toggleMic = () => {
    if (transcribing) return;
    if (listening) stopRec();
    else startRec();
  };

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
    <div className="mx-auto flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] max-w-3xl flex-col pb-[4.5rem] md:-mb-8 md:-mt-4 md:h-[calc(100dvh-3.5rem)] md:py-4">
      {/* Cabeçalho */}
      <div className="mb-3 flex items-end gap-3 md:mb-4">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:text-foreground md:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <MobilePageHeader
          className="mb-0 min-w-0 flex-1 md:mb-0"
          eyebrow="Assistente financeira · online"
          title="IARA"
          actions={
            <>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
                <SelectTrigger className="h-10 w-auto gap-1 rounded-full px-4 text-[13px]">
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
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </>
          }
        />
      </div>

      {/* Área do chat */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-border bg-surface md:rounded-3xl">
        {/* Privacidade */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[12px] text-foreground-muted md:px-6">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success-fg))]" />
          Lê seus lançamentos, contas e clientes — nada sai do BALANX.
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3.5 py-4 md:px-6 md:py-5">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex flex-col gap-1', m.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={cn('flex w-full items-end gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    m.role === 'assistant'
                      ? 'bg-info-bg text-info-fg'
                      : 'bg-surface-2 text-foreground-muted',
                  )}
                >
                  {m.role === 'assistant' ? <Sparkle className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                </div>
                <div
                  className={cn(
                    'px-3.5 py-2.5 text-[14px] leading-[1.55]',
                    m.role === 'assistant'
                      ? 'max-w-[88%] rounded-[16px_16px_16px_4px] bg-surface-2 text-foreground'
                      : 'max-w-[80%] rounded-[16px_16px_4px_16px] bg-primary text-primary-foreground',
                  )}
                >
                  {m.role === 'assistant' ? (
                    <IaraMarkdown content={m.content || '…'} />
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
              {m.role === 'assistant' && m.lancamentos && m.lancamentos.length > 0 && (
                <div className="w-full pl-[42px]">
                  <PropostaLancamentos lancamentos={m.lancamentos} onResolved={() => clearLancamentos(m.id)} />
                </div>
              )}
            </div>
          ))}
          {isLoading && lastIsUser && (
            <div className="flex items-end gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info-bg text-info-fg">
                <Sparkle className="h-4 w-4" />
              </div>
              <div className="rounded-[16px_16px_16px_4px] bg-surface-2 px-3.5 py-3">
                <div className="iara-typing"><i /><i /><i /></div>
              </div>
            </div>
          )}
        </div>

        {/* Sugestões */}
        <div className="flex gap-2 overflow-x-auto px-3.5 pb-2 pt-1 scrollbar-hide md:px-6">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              disabled={isLoading}
              className="h-9 shrink-0 rounded-full border border-border bg-surface px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); submit(input); }}
          className="px-3.5 pb-3.5 pt-1 md:px-6 md:pb-5"
        >
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1.5 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-ring">
            <label htmlFor="iara-input" className="sr-only">Pergunte à IARA</label>
            <input
              id="iara-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre seu caixa, metas, clientes…"
              disabled={isLoading}
              className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-foreground-muted"
            />
            <button
              type="button"
              onClick={toggleMic}
              disabled={transcribing}
              aria-label={listening ? 'Parar e transcrever' : 'Falar'}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95',
                listening
                  ? 'animate-pulse bg-danger-bg text-danger-fg'
                  : 'text-foreground-muted hover:bg-surface hover:text-foreground',
                transcribing && 'opacity-60',
              )}
            >
              {transcribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Enviar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

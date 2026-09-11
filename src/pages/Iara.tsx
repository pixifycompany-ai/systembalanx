import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ChevronLeft, RefreshCw, ShieldCheck, Loader2, Mic } from 'lucide-react';
import { UserIcon } from '@heroicons/react/24/solid';
import { Sparkle } from '@/components/shared/Sparkle';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  const { messages, isLoading, period, setPeriod, sendMessage, clearChat } = useFinancialAdvisor();
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
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[linear-gradient(150deg,hsl(var(--primary)/0.9),hsl(var(--primary)))] text-white shrink-0">
          <Sparkle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15.5px] font-[670] leading-tight tracking-[-0.02em]">IARA</div>
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[hsl(var(--success))] whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />online
          </div>
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
                'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full',
                m.role === 'assistant'
                  ? 'bg-[linear-gradient(150deg,hsl(var(--primary)/0.9),hsl(var(--primary)))] text-white'
                  : 'bg-surface-3 text-foreground-muted',
              )}
            >
              {m.role === 'assistant' ? <Sparkle className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
            </div>
            <div
              className={cn(
                'max-w-[80%] px-3.5 py-2.5 text-[13px] leading-[1.55]',
                m.role === 'assistant'
                  ? 'auro-card rounded-[18px_18px_18px_6px] bg-surface/55 backdrop-blur-xl border border-border/60 text-foreground'
                  : 'rounded-[18px_18px_6px_18px] bg-[linear-gradient(160deg,hsl(var(--primary)/0.9),hsl(var(--primary)))] text-white',
              )}
            >
              {m.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-table:my-2 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto -mx-1">
                          <table {...props} />
                        </div>
                      ),
                    }}
                  >
                    {m.content || '…'}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && lastIsUser && (
          <div className="flex gap-2.5 items-end">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(150deg,hsl(var(--primary)/0.9),hsl(var(--primary)))] text-white">
              <Sparkle className="h-4 w-4" />
            </div>
            <div className="auro-card rounded-[18px_18px_18px_6px] bg-surface/55 backdrop-blur-xl border border-border/60 px-3.5 py-3">
              <div className="iara-typing"><i /><i /><i /></div>
            </div>
          </div>
        )}
      </div>

      {/* Sugestões */}
      <div className="flex gap-2 overflow-x-auto px-3 md:px-4 py-2 scrollbar-hide">
        {SUGESTOES.map((s, i) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={isLoading}
            className="shrink-0 text-[11.5px] font-semibold text-foreground bg-surface/55 backdrop-blur-xl border border-border/60 rounded-full px-3.5 py-2 hover:border-border-strong transition-colors disabled:opacity-50"
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
          type="button"
          onClick={toggleMic}
          disabled={transcribing}
          aria-label={listening ? 'Parar e transcrever' : 'Falar'}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors active:scale-95',
            listening
              ? 'bg-[hsl(var(--danger))]/15 border-[hsl(var(--danger))] text-[hsl(var(--danger))] animate-pulse'
              : 'bg-surface/70 backdrop-blur-xl border-border/60 text-foreground-muted',
            transcribing && 'opacity-60',
          )}
        >
          {transcribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          aria-label="Enviar"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] text-white shadow-[0_10px_24px_-6px_hsl(var(--primary)/0.5)] active:scale-95 transition-transform disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  );
}

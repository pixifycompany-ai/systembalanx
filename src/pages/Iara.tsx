import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NotebookPen, Eraser } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFinancialAdvisor, type AnexoIara, type ContextoTela } from '@/hooks/useFinancialAdvisor';
import { PropostaLancamentos } from '@/components/iara/PropostaLancamentos';
import { PropostaAcoes } from '@/components/iara/PropostaAcoes';
import { ConexaoIara } from '@/components/iara/ConexaoIara';
import { ArquivosGerados, DocumentosIara } from '@/components/iara/ArquivosIara';
import { IaraTela } from '@/components/iara/IaraTela';

/** Quem abre /iara de outra tela pode mandar a pergunta e o que a pessoa estava vendo. */
export interface IaraNavState {
  pergunta?: string;
  contextoTela?: ContextoTela;
  /** Abrir já gravando (microfone da Início). */
  voz?: boolean;
}
const PERGUNTA_CONTEXTO = 'Me explica esses números: estão bons? Por quê?';

// Anexos: imagem (cartão CNPJ, print) ou PDF (contrato, contrato social), até 3 por pergunta.
const TIPOS_ANEXO = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_ANEXO_MB = 8;
const lerBase64 = (f: File) => new Promise<string>((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => erro(r.error);
  r.readAsDataURL(f);
});


export default function Iara() {
  const navigate = useNavigate();
  const location = useLocation();
  const { messages, isLoading, sendMessage, clearChat, clearLancamentos, clearAcoes, adicionarConversa } = useFinancialAdvisor();

  // O que a IARA preparou pelo Atalho do iPhone (últimas 24 h, ainda não visto) entra
  // no chat com os cards para confirmar. A notificação abre /iara?pendente=<id>.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const desde = new Date(Date.now() - 86400000).toISOString();
      const id = new URLSearchParams(window.location.search).get('pendente');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      let q = db.from('iara_pendentes').select('id, pergunta, resposta, acoes, lancamentos, created_at').order('created_at');
      q = id ? q.eq('id', id) : q.is('visto_em', null).gte('created_at', desde);
      const { data } = await q;
      if (!vivo || !data?.length) return;
      for (const p of data) adicionarConversa({ id: p.id, pergunta: p.pergunta, resposta: p.resposta, acoes: p.acoes, lancamentos: p.lancamentos, quando: new Date(p.created_at) });
      await db.from('iara_pendentes').update({ visto_em: new Date().toISOString() }).in('id', data.map((p: { id: string }) => p.id));
      if (id) window.history.replaceState(null, '', '/iara');
    })().catch(() => {});
    return () => { vivo = false; };
  }, [adicionarConversa]);
  const [anexos, setAnexos] = useState<AnexoIara[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const inputRef = useRef(input);
  inputRef.current = input;
  const [listening, setListening] = useState(false); // gravando
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const descartarRef = useRef(false); // cancelou a gravação: não transcreve
  // Tela que abriu a IARA (relatório, indicador…): vai junto de cada pergunta desta visita.
  const [contextoTela, setContextoTela] = useState<ContextoTela | null>(null);
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
      // Transcreveu → já envia e a IARA age (junta com o que já estava digitado, se houver).
      if (text) { const antes = inputRef.current.trim(); submitRef.current(antes ? `${antes} ${text}` : text); }
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
      if (descartarRef.current) { descartarRef.current = false; return; }
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

  const cancelarGravacao = () => {
    descartarRef.current = true;
    stopRec();
  };

  const toggleMic = () => {
    if (transcribing) return;
    if (listening) stopRec();
    else startRec();
  };
  const toggleMicRef = useRef(toggleMic);
  toggleMicRef.current = toggleMic;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const submit = (text: string) => {
    if ((!text.trim() && !anexos.length) || isLoading) return;
    sendMessage(text, anexos, contextoTela);
    setInput('');
    setAnexos([]);
  };
  // A gravação termina num callback antigo (onstop): usa sempre a versão atual do submit.
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Veio de outra tela com pergunta/contexto (ex.: "Explicar" num relatório): envia uma vez.
  const navState = location.state as IaraNavState | null;
  const navTratado = useRef<string | null>(null); // location.key já atendido
  useEffect(() => {
    if (!navState || (!navState.pergunta && !navState.contextoTela && !navState.voz) || navTratado.current === location.key) return;
    navTratado.current = location.key;
    if (navState.voz && !navState.pergunta) {
      navigate(location.pathname, { replace: true, state: null });
      toggleMicRef.current();
      return;
    }
    const ctx = navState.contextoTela ?? null;
    const pergunta = navState.pergunta?.trim() || (ctx ? PERGUNTA_CONTEXTO : '');
    setContextoTela(ctx);
    navigate(location.pathname, { replace: true, state: null });
    if (pergunta) sendMessage(pergunta, [], ctx);
  }, [navState, navigate, location.pathname, location.key, sendMessage]);

  // Veio do briefing das 8h (aviso no celular → /iara?resumo=hoje): pede o resumo do dia uma vez.
  const resumoTratado = useRef(false);
  useEffect(() => {
    if (resumoTratado.current || new URLSearchParams(location.search).get('resumo') !== 'hoje') return;
    resumoTratado.current = true;
    navigate(location.pathname, { replace: true });
    sendMessage('Meu resumo do dia', [], null);
  }, [location.search, location.pathname, navigate, sendMessage]);

  const anexar = async (files: FileList | null) => {
    if (!files?.length) return;
    const novos: AnexoIara[] = [];
    for (const f of Array.from(files)) {
      if (!TIPOS_ANEXO.includes(f.type)) {
        toast({ title: 'Arquivo não aceito', description: `${f.name}: envie imagem (PNG, JPG) ou PDF.`, variant: 'destructive' });
        continue;
      }
      if (f.size > MAX_ANEXO_MB * 1024 * 1024) {
        toast({ title: 'Arquivo grande demais', description: `${f.name}: até ${MAX_ANEXO_MB} MB.`, variant: 'destructive' });
        continue;
      }
      novos.push({ nome: f.name, tipo: f.type, base64: await lerBase64(f) });
    }
    setAnexos((prev) => [...prev, ...novos].slice(0, 3));
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <IaraTela
      messages={messages}
      isLoading={isLoading}
      input={input}
      setInput={setInput}
      onSubmit={submit}
      onLimpar={() => { clearChat(); setContextoTela(null); }}
      onVoltar={() => navigate(-1)}
      anexos={anexos}
      onRemoverAnexo={(i) => setAnexos((p) => p.filter((_, k) => k !== i))}
      onAnexar={() => fileRef.current?.click()}
      fileInput={<input ref={fileRef} type="file" accept={TIPOS_ANEXO.join(',')} multiple className="hidden" onChange={(e) => anexar(e.target.files)} />}
      listening={listening}
      transcribing={transcribing}
      onMic={toggleMic}
      onCancelarGravacao={cancelarGravacao}
      scrollRef={scrollRef}
      contexto={contextoTela ? [contextoTela.titulo, contextoTela.periodo].filter(Boolean).join(' · ') : null}
      onLimparContexto={() => setContextoTela(null)}
      renderPropostas={(m) => (
        <>
          {m.acoes && m.acoes.length > 0 && (
            <div className="mt-3"><PropostaAcoes acoes={m.acoes} onResolved={() => clearAcoes(m.id)} /></div>
          )}
          {m.lancamentos && m.lancamentos.length > 0 && (
            <div className="mt-3"><PropostaLancamentos lancamentos={m.lancamentos} onResolved={() => clearLancamentos(m.id)} /></div>
          )}
          {m.conexoes?.map((t) => <ConexaoIara key={t} tipo={t} />)}
          {m.documentos && m.documentos.length > 0 && <DocumentosIara docs={m.documentos} />}
          {m.arquivos && m.arquivos.length > 0 && <ArquivosGerados arquivos={m.arquivos} />}
          {m.memorias && m.memorias.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {m.memorias.map((x, i) => (
                <Link key={i} to="/perfil?abrir=memoria" title="Ver o que a IARA sabe sobre você"
                  className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition-colors',
                    x.acao === 'anotei' ? 'bg-info-bg text-info-fg hover:opacity-90' : 'bg-surface-2 text-foreground-muted hover:text-foreground')}>
                  {x.acao === 'anotei' ? <NotebookPen className="h-3.5 w-3.5 shrink-0" /> : <Eraser className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate"><b className="font-semibold">{x.acao === 'anotei' ? 'Anotei' : 'Esqueci'}:</b> {x.texto}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    />
  );
}

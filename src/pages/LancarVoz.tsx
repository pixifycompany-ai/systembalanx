import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, MicrophoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CometSpinner } from '@/components/shared/BalanxLoader';
import { Sparkle } from '@/components/shared/Sparkle';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useReceitas } from '@/hooks/useReceitas';
import { useDespesas } from '@/hooks/useDespesas';
import { useContas } from '@/hooks/useContas';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { type ItemLancamento, FREQ_LABEL, FORMA_LABEL, salvarItens, contaPadrao } from '@/lib/lancarItens';

type Fase = 'ouvindo' | 'processando' | 'revisar' | 'sem-suporte';

type ItemVoz = ItemLancamento;

export default function LancarVoz() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { categorias: catReceita, createReceita } = useReceitas();
  const { categorias: catDespesa, createDespesa, createDespesaParcelada } = useDespesas();
  const { contas } = useContas();

  // Contas ativas (inclui cartões de crédito, que caem na fatura aberta ao salvar).
  const contasAtivas = useMemo(() => (contas || []).filter((c) => c.ativa), [contas]);
  const isCartao = (contaId: string | null | undefined) =>
    !!contaId && contasAtivas.find((c) => c.id === contaId)?.tipo === 'cartao_credito';
  const nomeConta = (contaId: string | null | undefined) =>
    contasAtivas.find((c) => c.id === contaId)?.nome || 'Sem conta';
  // Conta padrão: primeira conta corrente (não-cartão); senão a primeira conta.
  const contaPadraoId = useMemo(() => contaPadrao(contasAtivas), [contasAtivas]);

  const [fase, setFase] = useState<Fase>('ouvindo');
  const [gravando, setGravando] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [itens, setItens] = useState<ItemVoz[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Web Speech é furada no iOS — usamos MediaRecorder + Whisper (edge function).
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setFase('sem-suporte');
    }
    return () => { try { mediaRecorderRef.current?.stop(); } catch { /* noop */ } };
  }, []);

  // Grava → transcreve (Whisper) → interpreta (parse-voz) → revisar.
  const transcrever = async (blob: Blob): Promise<string> => {
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
      method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` }, body: fd,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Falha na transcrição');
    return (data.text || '').trim();
  };

  const interpretar = async (texto: string): Promise<ItemVoz[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-voz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ transcript: texto }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erro ao interpretar');
    return (data.itens || []) as ItemVoz[];
  };

  const processar = async (blob: Blob) => {
    setFase('processando');
    try {
      const texto = await transcrever(blob);
      setTranscript(texto);
      if (!texto) { toast({ title: 'Não entendi o áudio', description: 'Toque no microfone e fale de novo.' }); setFase('ouvindo'); return; }
      const list = await interpretar(texto);
      if (!list.length) { toast({ title: 'Nada reconhecido', description: 'Ex.: "paguei 320 de energia hoje".' }); setFase('ouvindo'); setTranscript(''); return; }
      // Preenche padrão: conta corrente e status "quitado" (pago/recebido). Editável por item.
      setItens(list.map((it) => ({ ...it, conta_id: it.conta_id ?? contaPadraoId, quitado: it.quitado ?? true })));
      setFase('revisar');
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao processar', variant: 'destructive' });
      setFase('ouvindo');
    }
  };

  const startRec = async () => {
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
      if (blob.size > 0) await processar(blob);
      else setFase('ouvindo');
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setTranscript('');
    setGravando(true);
  };

  const stopRec = () => {
    try { mediaRecorderRef.current?.stop(); } catch { /* noop */ }
    setGravando(false);
  };

  const toggleGravar = () => { if (gravando) stopRec(); else startRec(); };

  const catsFor = (tipo: 'receita' | 'despesa') => (tipo === 'receita' ? catReceita : catDespesa);

  const corCategoria = (it: ItemVoz): string => {
    const list = catsFor(it.tipo) as any[];
    const found = list.find((c) => c.id === it.categoria_id) || list.find((c) => c.nome?.toLowerCase() === (it.categoria_nome || '').toLowerCase());
    return found?.cor || '#8fb0f0';
  };

  const totalRevisar = useMemo(() => itens.reduce((s, it) => s + (it.tipo === 'receita' ? it.valor : -it.valor), 0), [itens]);
  const nSaidas = itens.filter((i) => i.tipo === 'despesa').length;
  const nEntradas = itens.length - nSaidas;

  const refazer = () => {
    setFase('ouvindo'); setItens([]); setEditIdx(null); setTranscript(''); setGravando(false);
  };

  const statusLabel = (it: ItemVoz) => {
    if (it.tipo === 'despesa' && isCartao(it.conta_id)) return 'Na fatura';
    if (!it.quitado) return 'Pendente';
    return it.tipo === 'receita' ? 'Recebido' : 'Pago';
  };
  const setItem = (idx: number, patch: Partial<ItemVoz>) =>
    setItens((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const aplicarContaTodos = (id: string) => setItens((prev) => prev.map((x) => ({ ...x, conta_id: id })));
  const aplicarQuitadoTodos = (q: boolean) => setItens((prev) => prev.map((x) => ({ ...x, quitado: q })));

  const salvarTudo = async () => {
    setSalvando(true);
    const { ok, total } = await salvarItens(itens, {
      contas: contasAtivas, createReceita, createDespesa, createDespesaParcelada,
    });
    setSalvando(false);
    toast({ title: 'Lançamentos salvos', description: `${ok} de ${total} criado(s).` });
    navigate('/fluxo-caixa');
  };

  const ouvindo = fase === 'ouvindo';
  const processando = fase === 'processando';

  // Cabeçalho da tela (fica atrás do sheet na revisão).
  const header = (
    <div className="flex items-end gap-3">
      <button
        onClick={() => navigate(-1)}
        aria-label="Voltar"
        className="grid h-10 w-10 flex-none place-items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-2"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <MobilePageHeader
        className="mb-0 min-w-0 flex-1 md:mb-0"
        eyebrow={ouvindo ? 'IARA · ouvindo' : processando ? 'IARA · processando seu áudio' : 'IARA · processou seu áudio'}
        title={<>Lançar por <span className="font-serif italic font-normal tracking-normal">voz</span></>}
      />
    </div>
  );

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background">
      {fase === 'sem-suporte' && (
        <div className="flex flex-1 items-center justify-center px-4 text-center">
          <div className="w-full max-w-sm rounded-[20px] border border-border bg-surface p-6 md:rounded-3xl">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-foreground-muted">
              <MicrophoneIcon className="h-6 w-6" />
            </span>
            <p className="mb-1 text-[16px] font-semibold text-foreground">Voz indisponível neste navegador</p>
            <p className="text-[14px] text-foreground-muted">Use o Chrome no celular ou desktop para lançar falando.</p>
            <Button className="mt-5 h-12 w-full rounded-full font-semibold" onClick={() => navigate('/fluxo-caixa?action=nova-saida')}>
              Lançar manualmente
            </Button>
          </div>
        </div>
      )}

      {(ouvindo || processando) && (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+16px)] md:pt-12">
          {header}

          {/* Dica da IARA */}
          <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-border bg-surface p-4">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-info-bg text-info-fg">
              <Sparkle className="h-[18px] w-[18px]" />
            </span>
            <p className="text-[14px] leading-[1.55] text-foreground">
              Pode falar seus lançamentos que eu registro. Ex: <b className="font-semibold">"lance 20 de mercado e 50 de uber"</b>.
            </p>
          </div>

          {/* Microfone */}
          <div className="flex flex-1 flex-col items-center justify-center gap-5 py-8">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold',
                processando ? 'bg-info-bg text-info-fg' : gravando ? 'bg-danger-bg text-danger-fg' : 'bg-surface-2 text-foreground-muted',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full bg-current', gravando && 'animate-pulse')} />
              {processando ? 'Transcrevendo' : gravando ? 'Gravando' : 'Pronto'}
            </span>

            <button
              onClick={toggleGravar}
              disabled={processando}
              aria-label={gravando ? 'Parar e revisar' : 'Falar'}
              className={cn(
                'grid h-28 w-28 place-items-center rounded-full ring-[10px] transition-colors active:scale-95 disabled:opacity-60',
                gravando
                  ? 'bg-destructive text-destructive-foreground ring-danger-bg'
                  : 'bg-primary text-primary-foreground ring-surface-2',
              )}
            >
              <MicrophoneIcon className="h-11 w-11" />
            </button>

            <div className="h-9">
              {processando ? (
                <div className="grid h-9 place-items-center"><CometSpinner size={30} /></div>
              ) : (
                <div className={cn('vwave', !gravando && 'opacity-40')} aria-hidden>
                  {[0, 0.1, 0.25, 0.15, 0.35, 0.05, 0.3, 0.2, 0.4, 0.12, 0.28, 0.18, 0.36, 0.08].map((d, i) => (
                    <i key={i} style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              )}
            </div>

            <p className="text-[13px] font-medium text-foreground-muted">
              {processando ? 'Transcrevendo e interpretando…' : gravando ? 'Toque para parar' : 'Toque para falar'}
            </p>
          </div>

          {/* Transcrição */}
          <section className="rounded-[20px] border border-border bg-surface p-4 md:rounded-3xl md:p-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Transcrição</h2>
            <div className="min-h-[44px] text-[15px] leading-[1.5] text-foreground">
              {gravando
                ? <span className="text-foreground-muted">Ouvindo… fale seus lançamentos</span>
                : transcript
                  ? `"${transcript}"`
                  : <span className="text-foreground-muted">Toque no microfone e fale</span>}
            </div>
          </section>
        </div>
      )}

      {fase === 'revisar' && (
        <>
          {/* Cabeçalho residual (atrás do sheet) */}
          <div className="mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+16px)] opacity-40 md:pt-12">
            {header}
          </div>

          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => refazer()} />

          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-[26px] border-t border-border bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] md:bottom-6 md:rounded-[26px] md:border">
            <div className="mx-auto mb-1 mt-2.5 h-1 w-9 rounded-full bg-border-strong" />
            <div className="flex items-start justify-between gap-2.5 px-0.5 pb-3 pt-1">
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground-muted">
                  <Sparkle className="h-3 w-3 text-primary" />Reconhecido por voz · IARA
                </div>
                <h4 className="mt-[3px] text-[20px] font-semibold tracking-[-0.02em] text-foreground">Revisar lançamentos</h4>
              </div>
              <button onClick={() => refazer()} aria-label="Fechar" className="grid h-9 w-9 flex-none place-items-center rounded-full bg-surface-2 text-foreground-muted transition-colors hover:text-foreground">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 overflow-y-auto pb-2">
              {/* Transcrição */}
              <div className="flex items-start gap-2 rounded-[16px] bg-surface-2 px-3.5 py-3 text-[13px] italic leading-[1.5] text-foreground-muted">
                <MicrophoneIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>"{transcript}"</span>
              </div>

              {/* Padrão para todos: conta/cartão + status. Cartão de crédito cai na fatura aberta. */}
              {itens.length > 0 && (
                <div className="flex items-center gap-2 rounded-[16px] border border-border px-3 py-2">
                  <span className="flex-none text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Todos</span>
                  <Select value={itens[0]?.conta_id || 'none'} onValueChange={(v) => aplicarContaTodos(v)}>
                    <SelectTrigger className="h-9 flex-1 rounded-full text-[13px]"><SelectValue placeholder="Conta/Cartão" /></SelectTrigger>
                    <SelectContent>
                      {contasAtivas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}{c.tipo === 'cartao_credito' ? ' · cartão' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="inline-flex flex-none rounded-full bg-surface-2 p-0.5">
                    {([true, false] as const).map((q) => (
                      <button
                        key={String(q)}
                        onClick={() => aplicarQuitadoTodos(q)}
                        className={cn(
                          'rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                          itens.every((x) => x.quitado === q) ? (q ? 'bg-success-bg text-success-fg' : 'bg-surface text-foreground') : 'text-foreground-muted',
                        )}
                      >
                        {q ? 'Quitado' : 'Pendente'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Itens */}
              {itens.map((it, idx) => {
                const isReceita = it.tipo === 'receita';
                const editing = editIdx === idx;
                return (
                  <div key={idx} className="rounded-[20px] border border-border bg-surface p-3.5">
                    <div className="flex items-center gap-2.5">
                      {/* segmini */}
                      <div className="inline-flex flex-none rounded-full bg-surface-2 p-0.5">
                        {(['despesa', 'receita'] as const).map((tp) => {
                          const active = it.tipo === tp;
                          return (
                            <button
                              key={tp}
                              onClick={() => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, tipo: tp, categoria_id: null } : x))}
                              className={cn(
                                'rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                                active
                                  ? tp === 'despesa' ? 'bg-danger-bg text-danger-fg' : 'bg-success-bg text-success-fg'
                                  : 'text-foreground-muted',
                              )}
                            >
                              {tp === 'despesa' ? 'Saída' : 'Entrada'}
                            </button>
                          );
                        })}
                      </div>
                      <div className="min-w-0 flex-1 truncate text-[14px] font-semibold capitalize text-foreground">{it.descricao}</div>
                      <div className={cn('flex-none font-heading text-[15px] font-semibold tabular-nums tracking-[-0.02em]', isReceita ? 'text-[hsl(var(--success-fg))]' : 'text-[hsl(var(--danger-fg))]')}>
                        {isReceita ? '+' : '−'}{formatCurrency(it.valor).replace('R$', 'R$ ')}
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1.5 text-[12px] font-semibold text-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: corCategoria(it) }} />
                        {it.categoria_nome || 'Sem categoria'}
                      </span>
                      {it.categoria_nome && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-1 text-[11px] font-semibold text-info-fg">
                          sugerida
                        </span>
                      )}
                      <button onClick={() => setEditIdx(editing ? null : idx)} className="ml-auto text-[12px] font-semibold text-primary">
                        {editing ? 'Fechar' : 'Editar'}
                      </button>
                    </div>

                    {/* Conta/cartão + status do item */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: contasAtivas.find((c) => c.id === it.conta_id)?.cor || 'hsl(var(--foreground-muted))' }} />
                        {nomeConta(it.conta_id)}{isCartao(it.conta_id) ? ' · cartão' : ''}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-[11px] font-semibold',
                          it.tipo === 'despesa' && isCartao(it.conta_id)
                            ? 'bg-info-bg text-info-fg'
                            : it.quitado
                              ? 'bg-success-bg text-success-fg'
                              : 'bg-warning-bg text-warning-fg',
                        )}
                      >
                        {statusLabel(it)}
                      </span>
                      {/* O que a IARA detectou na fala */}
                      {it.fornecedor && (
                        <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-foreground-muted">🏪 {it.fornecedor}</span>
                      )}
                      {it.forma_pagamento && !isCartao(it.conta_id) && (
                        <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-foreground-muted">{FORMA_LABEL[it.forma_pagamento] || it.forma_pagamento}</span>
                      )}
                      {it.parcelas && it.parcelas > 1 && (
                        <span className="rounded-full bg-info-bg px-2 py-1 text-[11px] font-semibold text-info-fg">{it.parcelas}x no cartão</span>
                      )}
                      {it.recorrente && (
                        <span className="rounded-full bg-info-bg px-2 py-1 text-[11px] font-semibold text-info-fg">repete {it.recorrente.repeticoes}× / {FREQ_LABEL[it.recorrente.frequencia]}</span>
                      )}
                    </div>

                    {editing && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        <Input value={it.descricao} onChange={(e) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x))} placeholder="Descrição" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="number" step="0.01" value={it.valor || ''} onChange={(e) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, valor: parseFloat(e.target.value) || 0 } : x))} placeholder="Valor" />
                          <Input type="date" value={it.data} onChange={(e) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, data: e.target.value } : x))} />
                        </div>
                        <Select value={it.categoria_id || 'none'} onValueChange={(v) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, categoria_id: v === 'none' ? null : v, categoria_nome: v === 'none' ? x.categoria_nome : (catsFor(x.tipo) as any[]).find((c) => c.id === v)?.nome ?? x.categoria_nome } : x))}>
                          <SelectTrigger className="text-sm"><SelectValue placeholder="Categoria" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{it.categoria_nome ? `Sugerida: ${it.categoria_nome}` : 'Sem categoria'}</SelectItem>
                            {catsFor(it.tipo).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {/* Conta / cartão */}
                        <Select value={it.conta_id || 'none'} onValueChange={(v) => setItem(idx, { conta_id: v === 'none' ? null : v })}>
                          <SelectTrigger className="text-sm"><SelectValue placeholder="Conta/Cartão" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem conta</SelectItem>
                            {contasAtivas.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.nome}{c.tipo === 'cartao_credito' ? ' · cartão' : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Status */}
                        {it.tipo === 'despesa' && isCartao(it.conta_id) ? (
                          <p className="rounded-[14px] bg-info-bg px-3 py-2 text-[12px] leading-[1.45] text-info-fg">
                            Cartão de crédito → entra na <b>fatura aberta</b>. Fica pendente até você pagar a fatura.
                          </p>
                        ) : (
                          <div className="inline-flex rounded-full bg-surface-2 p-0.5">
                            {([true, false] as const).map((q) => (
                              <button
                                key={String(q)}
                                onClick={() => setItem(idx, { quitado: q })}
                                className={cn(
                                  'rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
                                  it.quitado === q ? (q ? 'bg-success-bg text-success-fg' : 'bg-warning-bg text-warning-fg') : 'text-foreground-muted',
                                )}
                              >
                                {q ? (it.tipo === 'receita' ? 'Recebido' : 'Pago') : 'Pendente'}
                              </button>
                            ))}
                          </div>
                        )}

                        <button onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))} className="block text-[12px] font-semibold text-[hsl(var(--danger-fg))]">
                          Remover item
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Aviso + total */}
              <p className="px-2 pt-1 text-center text-[12px] leading-[1.45] text-foreground-muted">
                A IARA pode errar valor ou categoria — confira antes de salvar. Total: <b className={cn('font-heading font-semibold tabular-nums', totalRevisar < 0 ? 'text-[hsl(var(--danger-fg))]' : 'text-[hsl(var(--success-fg))]')}>{totalRevisar < 0 ? '−' : ''}{formatCurrency(Math.abs(totalRevisar))}</b>
                {nSaidas > 0 && ` · ${nSaidas} ${nSaidas === 1 ? 'saída' : 'saídas'}`}
                {nEntradas > 0 && ` · ${nEntradas} ${nEntradas === 1 ? 'entrada' : 'entradas'}`}.
              </p>
            </div>

            {/* Rodapé */}
            <div className="flex gap-2.5 pt-3.5">
              <Button variant="outline" onClick={() => refazer()} className="h-12 flex-[0_0_34%] rounded-full text-[14px] font-semibold">
                Cancelar
              </Button>
              <Button
                onClick={salvarTudo}
                disabled={salvando || itens.length === 0}
                className="h-12 flex-1 rounded-full text-[14px] font-semibold"
              >
                {salvando ? 'Salvando…' : `Confirmar ${itens.length} ${itens.length === 1 ? 'lançamento' : 'lançamentos'}`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

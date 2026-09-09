import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, MicrophoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CometSpinner } from '@/components/shared/BalanxLoader';
import { useToast } from '@/hooks/use-toast';
import { useReceitas } from '@/hooks/useReceitas';
import { useDespesas } from '@/hooks/useDespesas';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

type Fase = 'ouvindo' | 'processando' | 'revisar' | 'sem-suporte';

interface ItemVoz {
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  categoria_id: string | null;
  categoria_nome: string | null;
  data: string;
}

/** Estrelinha de 4 pontas (isotipo IARA), igual mockup. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" fill="currentColor" />
    </svg>
  );
}

export default function LancarVoz() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { categorias: catReceita, createReceita } = useReceitas();
  const { categorias: catDespesa, createDespesa } = useDespesas();

  const [fase, setFase] = useState<Fase>('ouvindo');
  const [transcript, setTranscript] = useState('');
  const [itens, setItens] = useState<ItemVoz[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const finalRef = useRef('');

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setFase('sem-suporte'); return; }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += t + ' ';
        else interim += t;
      }
      setTranscript((finalRef.current + interim).trim());
    };
    rec.onerror = () => { /* ignora; usuário pode parar manualmente */ };
    recognitionRef.current = rec;
    try { rec.start(); } catch { /* já iniciado */ }
    return () => { try { rec.stop(); } catch { /* noop */ } };
  }, []);

  const catsFor = (tipo: 'receita' | 'despesa') => (tipo === 'receita' ? catReceita : catDespesa);

  const corCategoria = (it: ItemVoz): string => {
    const list = catsFor(it.tipo) as any[];
    const found = list.find((c) => c.id === it.categoria_id) || list.find((c) => c.nome?.toLowerCase() === (it.categoria_nome || '').toLowerCase());
    return found?.cor || '#8fb0f0';
  };

  const totalRevisar = useMemo(() => itens.reduce((s, it) => s + (it.tipo === 'receita' ? it.valor : -it.valor), 0), [itens]);
  const nSaidas = itens.filter((i) => i.tipo === 'despesa').length;
  const nEntradas = itens.length - nSaidas;

  const pararEProcessar = async () => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    const texto = (finalRef.current || transcript).trim();
    if (!texto) { toast({ title: 'Não ouvi nada', description: 'Toque no microfone e fale os lançamentos.' }); return; }
    setFase('processando');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-voz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ transcript: texto }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao interpretar');
      const list: ItemVoz[] = data.itens || [];
      if (!list.length) { toast({ title: 'Nada reconhecido', description: 'Tente de novo, ex.: "paguei 320 de energia hoje".' }); setFase('ouvindo'); finalRef.current = ''; setTranscript(''); try { recognitionRef.current?.start(); } catch { /* noop */ } return; }
      setItens(list);
      setFase('revisar');
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao processar', variant: 'destructive' });
      setFase('ouvindo');
    }
  };

  const refazer = () => {
    setFase('ouvindo'); setItens([]); setEditIdx(null); finalRef.current = ''; setTranscript('');
    try { recognitionRef.current?.start(); } catch { /* noop */ }
  };

  const salvarTudo = async () => {
    setSalvando(true);
    let ok = 0;
    for (const it of itens) {
      try {
        if (it.tipo === 'receita') {
          await createReceita({
            descricao: it.descricao, valor: it.valor, categoria_id: it.categoria_id || undefined,
            data_competencia: it.data, data_vencimento: it.data, status: 'pendente',
          } as any);
        } else {
          await createDespesa({
            descricao: it.descricao, valor: it.valor, categoria_id: it.categoria_id || undefined,
            data_competencia: it.data, data_vencimento: it.data, status: 'pendente', tipo: 'variavel',
          } as any);
        }
        ok++;
      } catch { /* segue */ }
    }
    setSalvando(false);
    toast({ title: 'Lançamentos salvos', description: `${ok} de ${itens.length} criado(s).` });
    navigate('/fluxo-caixa');
  };

  const ouvindo = fase === 'ouvindo';
  const processando = fase === 'processando';

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Glow ambiente AURO */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 40% at 12% 4%, hsl(var(--primary) / 0.34), transparent 66%), radial-gradient(55% 36% at 92% 2%, hsl(38 82% 55% / 0.26), transparent 64%), radial-gradient(80% 50% at 50% 116%, hsl(var(--primary) / 0.22), transparent 72%)',
        }}
      />

      {fase === 'sem-suporte' && (
        <div className="relative flex flex-1 place-items-center px-8 text-center">
          <div className="m-auto">
            <p className="mb-1 font-medium text-foreground">Voz indisponível neste navegador</p>
            <p className="text-sm text-foreground-muted">Use o Chrome no celular ou desktop para lançar falando.</p>
            <button className="mt-5 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-white" onClick={() => navigate('/fluxo-caixa?action=nova-saida')}>
              Lançar manualmente
            </button>
          </div>
        </div>
      )}

      {(ouvindo || processando) && (
        <div className="relative flex flex-1 flex-col px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
          {/* Header do chat */}
          <div className="flex items-center gap-2.5 pb-3">
            <button onClick={() => navigate(-1)} aria-label="Voltar" className="grid h-9 w-9 flex-none place-items-center rounded-[11px] border border-border/60 bg-surface/70 text-foreground backdrop-blur-xl">
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-[linear-gradient(150deg,hsl(var(--primary)/0.9),hsl(var(--primary)))] text-white">
                <Sparkle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[15.5px] font-[670] leading-tight tracking-[-0.02em] text-foreground">IARA</div>
                {ouvindo ? (
                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[hsl(var(--success))]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />ouvindo
                  </div>
                ) : (
                  <div className="text-[10.5px] font-semibold text-foreground-muted">processando seu áudio</div>
                )}
              </div>
            </div>
          </div>

          {/* Mensagem da IARA */}
          <div className="flex flex-1 flex-col gap-3.5 pt-1">
            <div className="flex items-end gap-2.5">
              <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-[linear-gradient(150deg,hsl(var(--primary)/0.9),hsl(var(--primary)))] text-white">
                <Sparkle className="h-4 w-4" />
              </div>
              <div className="max-w-[82%] rounded-[18px_18px_18px_6px] border border-border/60 bg-surface/70 px-3.5 py-2.5 text-[13px] leading-[1.55] text-foreground backdrop-blur-xl">
                Pode falar seus lançamentos que eu registro. Ex: <b>"lance 20 de mercado e 50 de uber"</b>.
              </div>
            </div>
          </div>

          {/* Voicedock */}
          <div className="mb-4 mt-auto rounded-[24px] border border-border/70 bg-surface/80 px-4 pb-4 pt-[18px] shadow-[0_-10px_30px_-14px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.04em] text-[hsl(var(--danger))]">
                <span className={cn('h-2 w-2 rounded-full bg-[hsl(var(--danger))]', ouvindo && 'animate-pulse')} />
                {processando ? 'Processando' : 'Ouvindo'}
              </span>
              <span className="ml-auto text-[11px] font-semibold text-foreground-subtle">IARA</span>
            </div>

            {processando ? (
              <div className="grid h-9 place-items-center"><CometSpinner size={30} /></div>
            ) : (
              <div className="vwave" aria-hidden>
                {[0, 0.1, 0.25, 0.15, 0.35, 0.05, 0.3, 0.2, 0.4, 0.12, 0.28, 0.18, 0.36, 0.08].map((d, i) => (
                  <i key={i} style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            )}

            <div className="mt-3 min-h-[44px] text-center text-[14px] leading-[1.5] text-foreground">
              {transcript
                ? `"${transcript}"`
                : <span className="text-foreground-subtle">Fale seus lançamentos…</span>}
            </div>

            <button
              onClick={pararEProcessar}
              disabled={processando}
              aria-label="Parar e revisar"
              className="mx-auto mt-3.5 grid h-[60px] w-[60px] place-items-center rounded-full bg-[linear-gradient(160deg,hsl(var(--danger)),#c62b1e)] text-white shadow-[0_0_0_8px_hsl(var(--danger)/0.16),0_10px_24px_hsl(var(--danger)/0.4)] disabled:opacity-60"
            >
              <MicrophoneIcon className="h-7 w-7" />
            </button>
            <div className="mt-2.5 text-center text-[11px] text-foreground-subtle">
              {processando ? 'Interpretando…' : 'Toque no microfone pra parar'}
            </div>
          </div>
        </div>
      )}

      {fase === 'revisar' && (
        <>
          {/* Cabeçalho residual do chat (blur atrás) */}
          <div className="relative flex items-center gap-2.5 px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 opacity-40">
            <div className="grid h-9 w-9 flex-none place-items-center rounded-[11px] border border-border/60 bg-surface/70 text-foreground">
              <ChevronLeftIcon className="h-5 w-5" />
            </div>
            <div className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-primary text-white"><Sparkle className="h-4 w-4" /></div>
            <div>
              <div className="text-[15.5px] font-[670] text-foreground">IARA</div>
              <div className="text-[10.5px] font-semibold text-foreground-muted">processou seu áudio</div>
            </div>
          </div>

          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => refazer()} />

          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-[26px] border-t border-border/60 bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <div className="mx-auto mb-1 mt-2.5 h-1 w-9 rounded-full bg-white/20" />
            <div className="flex items-start justify-between gap-2.5 px-0.5 pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground-muted">
                  <Sparkle className="h-3 w-3 text-primary" />Reconhecido por voz · IARA
                </div>
                <h4 className="mt-[3px] text-[19px] font-[670] tracking-[-0.02em] text-foreground">Revisar lançamentos</h4>
              </div>
              <button onClick={() => refazer()} aria-label="Fechar" className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-surface-2 text-foreground-muted">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 overflow-y-auto pb-2">
              {/* Transcrição */}
              <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-surface/70 px-3 py-2.5 text-[12px] italic leading-[1.5] text-foreground-muted">
                <MicrophoneIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>"{transcript}"</span>
              </div>

              {/* Itens */}
              {itens.map((it, idx) => {
                const isReceita = it.tipo === 'receita';
                const editing = editIdx === idx;
                return (
                  <div key={idx} className="rounded-2xl border border-border/60 bg-surface/70 p-3.5">
                    <div className="flex items-center gap-2.5">
                      {/* segmini */}
                      <div className="inline-flex flex-none rounded-[9px] border border-border/60 bg-surface-2 p-0.5">
                        {(['despesa', 'receita'] as const).map((tp) => {
                          const active = it.tipo === tp;
                          return (
                            <button
                              key={tp}
                              onClick={() => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, tipo: tp, categoria_id: null } : x))}
                              className={cn(
                                'rounded-[7px] px-2.5 py-[5px] text-[10.5px] font-bold transition-colors',
                                active
                                  ? tp === 'despesa' ? 'bg-[hsl(var(--danger))] text-white' : 'bg-[hsl(var(--success))] text-white'
                                  : 'text-foreground-muted',
                              )}
                            >
                              {tp === 'despesa' ? 'Saída' : 'Entrada'}
                            </button>
                          );
                        })}
                      </div>
                      <div className="min-w-0 flex-1 truncate text-[14px] font-[640] capitalize text-foreground">{it.descricao}</div>
                      <div className={cn('flex-none text-[15px] font-bold tabular-nums', isReceita ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
                        {isReceita ? '+' : '−'}{formatCurrency(it.valor).replace('R$', 'R$ ')}
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-2 px-2.5 py-1.5 text-[11.5px] font-semibold text-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: corCategoria(it) }} />
                        {it.categoria_nome || 'Sem categoria'}
                      </span>
                      {it.categoria_nome && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/25 px-2 py-1 text-[10px] font-bold text-[hsl(var(--primary))]">
                          ✦ sugerida
                        </span>
                      )}
                      <button onClick={() => setEditIdx(editing ? null : idx)} className="ml-auto text-[11.5px] font-semibold text-foreground-muted">
                        {editing ? 'Fechar' : 'Editar'}
                      </button>
                    </div>

                    {editing && (
                      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
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
                        <button onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))} className="text-[11.5px] font-semibold text-[hsl(var(--danger))]">
                          Remover item
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Aviso + total */}
              <p className="px-2 pt-1 text-center text-[11px] leading-[1.4] text-foreground-subtle">
                A IARA pode errar valor ou categoria — confira antes de salvar. Total: <b className={totalRevisar < 0 ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--success))]'}>{totalRevisar < 0 ? '−' : ''}{formatCurrency(Math.abs(totalRevisar))}</b>
                {nSaidas > 0 && ` · ${nSaidas} ${nSaidas === 1 ? 'saída' : 'saídas'}`}
                {nEntradas > 0 && ` · ${nEntradas} ${nEntradas === 1 ? 'entrada' : 'entradas'}`}.
              </p>
            </div>

            {/* Rodapé */}
            <div className="flex gap-2.5 pt-3.5">
              <button onClick={() => refazer()} className="flex-[0_0_34%] rounded-[14px] bg-surface-2 py-3 text-[13px] font-semibold text-foreground">
                Cancelar
              </button>
              <button
                onClick={salvarTudo}
                disabled={salvando || itens.length === 0}
                className="flex-1 rounded-[14px] bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] py-3 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : `Confirmar ${itens.length} ${itens.length === 1 ? 'lançamento' : 'lançamentos'}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

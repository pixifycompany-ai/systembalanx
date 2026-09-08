import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, MicrophoneIcon, TrashIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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

export default function LancarVoz() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { categorias: catReceita, createReceita } = useReceitas();
  const { categorias: catDespesa, createDespesa } = useDespesas();

  const [fase, setFase] = useState<Fase>('ouvindo');
  const [transcript, setTranscript] = useState('');
  const [itens, setItens] = useState<ItemVoz[]>([]);
  const [salvando, setSalvando] = useState(false);
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

  const catsFor = (tipo: 'receita' | 'despesa') => (tipo === 'receita' ? catReceita : catDespesa);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <span className="text-sm font-semibold text-foreground">Lançar por voz</span>
        <button onClick={() => navigate(-1)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-foreground-muted">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {fase === 'sem-suporte' && (
        <div className="flex-1 grid place-items-center px-8 text-center">
          <div>
            <p className="text-foreground font-medium mb-1">Voz indisponível neste navegador</p>
            <p className="text-sm text-foreground-muted">Use o Chrome no celular ou desktop para lançar falando.</p>
            <Button className="mt-5" onClick={() => navigate('/fluxo-caixa?action=nova-saida')}>Lançar manualmente</Button>
          </div>
        </div>
      )}

      {(fase === 'ouvindo' || fase === 'processando') && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="relative grid place-items-center mb-8">
            {fase === 'ouvindo' && <span className="absolute h-32 w-32 rounded-full bg-primary/20 animate-ping" />}
            <div className="relative grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_30px_-6px_hsl(var(--primary)/0.6)]">
              {fase === 'processando' ? <CometSpinner size={36} /> : <MicrophoneIcon className="h-10 w-10" />}
            </div>
          </div>
          <p className="text-lg font-semibold text-foreground mb-1">
            {fase === 'processando' ? 'Interpretando…' : 'IARA ouvindo'}
          </p>
          <p className="text-sm text-foreground-muted max-w-[30ch] min-h-[40px]">
            {transcript || 'Fale seus lançamentos. Ex.: "recebi 1200 do cliente Verano e paguei 320 de energia hoje".'}
          </p>
          {fase === 'ouvindo' && (
            <Button className="mt-8 h-12 px-8 rounded-2xl font-semibold" onClick={pararEProcessar}>
              Parar e revisar
            </Button>
          )}
        </div>
      )}

      {fase === 'revisar' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pb-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Revisar antes de salvar</h1>
            <p className="text-sm text-foreground-muted">Ajuste o que precisar. {itens.length} item(ns).</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
            {itens.map((it, idx) => (
              <div key={idx} className="rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="inline-flex rounded-lg border border-border/60 p-0.5">
                    {(['receita', 'despesa'] as const).map((tp) => (
                      <button
                        key={tp}
                        onClick={() => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, tipo: tp, categoria_id: null } : x))}
                        className={cn('px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
                          it.tipo === tp
                            ? tp === 'receita' ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]'
                            : 'text-foreground-muted')}
                      >
                        {tp === 'receita' ? 'Entrada' : 'Saída'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remover" className="ml-auto text-foreground-muted hover:text-[hsl(var(--danger))]">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  value={it.descricao}
                  onChange={(e) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x))}
                  className="mb-2"
                  placeholder="Descrição"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={it.valor || ''}
                    onChange={(e) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, valor: parseFloat(e.target.value) || 0 } : x))}
                    placeholder="Valor"
                  />
                  <Input
                    type="date"
                    value={it.data}
                    onChange={(e) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, data: e.target.value } : x))}
                  />
                </div>
                <div className="mt-2">
                  <Select
                    value={it.categoria_id || 'none'}
                    onValueChange={(v) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, categoria_id: v === 'none' ? null : v } : x))}
                  >
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{it.categoria_nome ? `Sugerida: ${it.categoria_nome}` : 'Sem categoria'}</SelectItem>
                      {catsFor(it.tipo).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2 text-right text-sm font-bold tabular-nums" style={{ color: it.tipo === 'receita' ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
                  {it.tipo === 'receita' ? '+ ' : '- '}{formatCurrency(it.valor)}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-border/60 flex gap-2">
            <Button variant="ghost" onClick={() => { setFase('ouvindo'); setItens([]); finalRef.current = ''; setTranscript(''); try { recognitionRef.current?.start(); } catch { /* noop */ } }}>
              Refazer
            </Button>
            <Button className="flex-1" onClick={salvarTudo} disabled={salvando || itens.length === 0}>
              {salvando ? 'Salvando…' : `Salvar ${itens.length} lançamento(s)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

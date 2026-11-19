import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Sparkle } from '@/components/shared/Sparkle';
import { useClientes } from '@/hooks/useClientes';
import { useTenant } from '@/contexts/TenantContext';
import { NAV_TODOS, NOVO_ACOES } from './navItems';

type Res = { g: string; r: string; icon: React.ReactNode; acao: () => void };
const PERGUNTA = /\?|\b(quanto|qual|quais|quem|posso|como|quando|por que|porque|devo|vou)\b/i;
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Conteúdo só monta com a busca aberta (a lista de clientes é carregada aí). */
function Conteudo({ fechar }: { fechar: () => void }) {
  const navigate = useNavigate();
  const { clientes } = useClientes();
  const { isSuperadmin } = useTenant();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const ir = (to: string, state?: unknown) => { fechar(); navigate(to, state ? { state } : undefined); };

  const res = useMemo<Res[]>(() => {
    const t = semAcento(q.trim());
    const pergunta = q.trim().length > 2 && PERGUNTA.test(q);
    const telas = [...NAV_TODOS, ...(isSuperadmin ? [{ href: '/superadmin', label: 'Superadmin', icon: Search }] : [])];
    const pag = telas.filter((x) => !t || semAcento(x.label).includes(t)).slice(0, t ? 6 : 5)
      .map((x) => ({ g: 'Ir para', r: x.label, icon: <x.icon className="h-4 w-4" />, acao: () => ir(x.href) }));
    const acoes = NOVO_ACOES.filter((a) => !t || semAcento(`nova novo ${a.label} ${a.desc}`).includes(t)).slice(0, t ? 6 : 3)
      .map((a) => ({ g: 'Criar', r: a.label === 'Lançar por voz' || a.label.startsWith('Subir') ? a.label : `Nova ${a.label.toLowerCase()}`, icon: <a.icon className="h-4 w-4" />, acao: () => ir(a.to) }));
    const cli = t.length >= 2 ? clientes.filter((c) => semAcento(c.nome).includes(t)).slice(0, 5)
      .map((c) => ({ g: 'Clientes', r: c.nome, icon: <Users className="h-4 w-4" />, acao: () => ir(`/fluxo-caixa?mes=all&search=${encodeURIComponent(c.nome)}`) })) : [];
    const iara = pergunta || (t.length > 2 && !pag.length && !acoes.length && !cli.length)
      ? [{ g: 'IARA', r: `Perguntar: “${q.trim()}”`, icon: <Sparkle className="h-4 w-4" />, acao: () => ir('/iara', { pergunta: q.trim() }) }]
      : [];
    return [...iara, ...pag, ...acoes, ...cli];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, clientes, isSuperadmin]);
  const grupos = [...new Set(res.map((r) => r.g))];

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <Search className="h-5 w-5 text-foreground-muted" />
        <SheetTitle className="sr-only">Busca rápida</SheetTitle>
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          placeholder="Buscar tela, cliente ou perguntar à IARA…"
          aria-label="Buscar"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(res.length - 1, v + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
            if (e.key === 'Enter' && res[i]) { e.preventDefault(); res[i].acao(); }
          }}
          className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-foreground-muted"
        />
        <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] text-foreground-muted sm:block">esc</kbd>
      </div>
      <div className="max-h-[56dvh] overflow-y-auto p-2">
        {grupos.map((g) => (
          <div key={g} className="mb-1">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">{g}</p>
            {res.map((r, k) => r.g === g && (
              <button key={`${g}-${r.r}-${k}`} type="button" onMouseEnter={() => setI(k)} onClick={r.acao}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px]', k === i ? 'bg-foreground text-background' : 'text-foreground')}>
                <span className={cn('grid h-8 w-8 place-items-center rounded-full', k === i ? 'bg-background/15' : 'bg-surface-2 text-foreground-muted')}>{r.icon}</span>
                <span className="min-w-0 flex-1 truncate">{r.r}</span>
                {k === i && <CornerDownLeft className="h-4 w-4 opacity-60" />}
              </button>
            ))}
          </div>
        ))}
        {!res.length && <p className="px-3 py-8 text-center text-[13.5px] text-foreground-muted">Nada encontrado. Termine com “?” para perguntar à IARA.</p>}
      </div>
      <div className="hidden items-center gap-4 border-t border-border px-5 py-2.5 text-[11.5px] text-foreground-muted sm:flex">
        <span><kbd className="rounded border border-border px-1">↑</kbd> <kbd className="rounded border border-border px-1">↓</kbd> navegar</span>
        <span><kbd className="rounded border border-border px-1">↵</kbd> abrir</span>
        <span className="ml-auto flex items-center gap-1"><Sparkle className="h-3 w-3" />Perguntas vão para a IARA</span>
      </div>
    </>
  );
}

/** Busca rápida (⌘K / Ctrl+K): telas, ações, clientes e perguntas para a IARA. */
export function BuscaRapida({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className="max-h-[85dvh] overflow-hidden rounded-t-[26px] bg-surface p-0 sm:max-w-[620px] md:!top-[12vh] md:!translate-y-0">
        {open && <Conteudo fechar={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

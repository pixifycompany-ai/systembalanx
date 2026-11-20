// Memória da IARA (Meu Perfil): o que a IARA guardou sobre a pessoa e a empresa.
// A pessoa vê, apaga e também pode ensinar algo à mão. Tabela iara_memorias (RLS: só a dona).
import { useCallback, useEffect, useState } from 'react';
import { Loader2, NotebookPen, Plus, Trash2, User, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Segmented } from '@/components/reskin/kit';
import { btn } from '@/components/reskin/estilos';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/formatters';
import { toast } from 'sonner';

interface Memoria { id: string; texto: string; tenant_id: string | null; origem: string; created_at: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function MemoriaIaraPainel({ onMudou }: { onMudou?: (n: number) => void }) {
  const { activeTenant } = useTenant();
  const [itens, setItens] = useState<Memoria[] | null>(null);
  const [texto, setTexto] = useState('');
  const [escopo, setEscopo] = useState<'pessoal' | 'empresa'>('pessoal');
  const [salvando, setSalvando] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);
  const [confirmarTudo, setConfirmarTudo] = useState(false);

  const carregar = useCallback(async () => {
    let q = db.from('iara_memorias').select('id, texto, tenant_id, origem, created_at').order('created_at', { ascending: false });
    q = activeTenant?.id ? q.or(`tenant_id.is.null,tenant_id.eq.${activeTenant.id}`) : q.is('tenant_id', null);
    const { data, error } = await q;
    if (error) { setItens([]); return; }
    setItens(data as Memoria[]);
    onMudou?.((data as Memoria[]).length);
  }, [activeTenant?.id, onMudou]);
  useEffect(() => { void carregar(); }, [carregar]);

  const adicionar = async () => {
    const t = texto.trim();
    if (t.length < 3) return;
    setSalvando(true);
    const { error } = await db.from('iara_memorias').insert({ texto: t.slice(0, 300), tenant_id: escopo === 'empresa' ? activeTenant?.id ?? null : null, origem: 'manual' });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    setTexto('');
    toast.success('A IARA vai lembrar disso.');
    void carregar();
  };
  const apagar = async (id: string) => {
    setApagando(id);
    const { error } = await db.from('iara_memorias').delete().eq('id', id);
    setApagando(null);
    if (error) { toast.error(error.message); return; }
    void carregar();
  };
  const apagarTudo = async () => {
    if (!itens?.length) return;
    setApagando('tudo');
    const { error } = await db.from('iara_memorias').delete().in('id', itens.map((m) => m.id));
    setApagando(null);
    setConfirmarTudo(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Memória apagada.');
    void carregar();
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-foreground-muted">
        Quando você conta algo que vale para sempre (quem é o seu contador, por qual conta paga a luz, como prefere as respostas),
        a IARA anota e usa nas próximas conversas. Só você vê. Para ela esquecer, apague aqui ou diga "esquece isso" no chat.
      </p>

      <div className="rounded-[18px] border border-border p-3">
        <div className="flex gap-2">
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300}
            onKeyDown={(e) => { if (e.key === 'Enter') void adicionar(); }}
            placeholder="Ex.: a luz eu pago pelo Itaú" aria-label="Nova lembrança" />
          <button type="button" onClick={adicionar} disabled={salvando || texto.trim().length < 3} className={cn(btn.primary, 'w-10 shrink-0 px-0')} aria-label="Adicionar">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-foreground-muted">
          Vale para
          <Segmented<'pessoal' | 'empresa'> size="sm" value={escopo} onChange={setEscopo}
            opts={[['pessoal', 'Você'], ['empresa', activeTenant?.nome ? `Só ${activeTenant.nome}` : 'Esta empresa']]} />
        </div>
      </div>

      {itens === null ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-foreground-muted" /></div>
      ) : itens.length === 0 ? (
        <div className="flex items-start gap-3 rounded-[18px] bg-surface-2 px-4 py-3.5">
          <NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />
          <p className="text-[13px] text-foreground-muted">A IARA ainda não anotou nada. Converse com ela normalmente: quando você contar algo que vale para sempre, aparece um "Anotei" na conversa e a lembrança fica aqui.</p>
        </div>
      ) : (
        <>
          <ul className="overflow-hidden rounded-[18px] border border-border">
            {itens.map((m) => (
              <li key={m.id} className="flex items-start gap-3 border-t border-border px-3.5 py-3 first:border-t-0">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-foreground-muted">
                  {m.tenant_id ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] leading-snug text-foreground">{m.texto}</span>
                  <span className="mt-0.5 block text-[11.5px] text-foreground-muted">
                    {m.tenant_id ? (activeTenant?.nome || 'Esta empresa') : 'Sobre você'} · {m.origem === 'manual' ? 'você ensinou' : 'anotado pela IARA'} em {formatDate(m.created_at.slice(0, 10))}
                  </span>
                </span>
                <button type="button" onClick={() => apagar(m.id)} disabled={apagando === m.id} aria-label="Apagar lembrança"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-foreground-muted hover:bg-danger-bg hover:text-danger-fg disabled:opacity-50">
                  {apagando === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            {confirmarTudo ? (
              <div className="flex items-center gap-2 text-[12.5px] text-foreground-muted">
                Apagar as {itens.length}?
                <button type="button" onClick={() => setConfirmarTudo(false)} className={btn.ghost}>Cancelar</button>
                <button type="button" onClick={apagarTudo} disabled={apagando === 'tudo'} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-danger-fg px-3.5 text-[13px] font-semibold text-white disabled:opacity-50">
                  {apagando === 'tudo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Apagar tudo
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmarTudo(true)} className="text-[12.5px] text-foreground-muted hover:text-danger-fg">Apagar tudo</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

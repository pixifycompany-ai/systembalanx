// Criar / editar compromisso ou tarefa.
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { Campo, ModalFooter, ModalHeader, ModalShell, Segmented } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';
import { useClientes } from '@/hooks/useClientes';
import type { AgendaItem, NovoAgendaItem } from '@/hooks/useAgenda';
import { agendasGoogle, conectarGoogle, listasEscolhidas, statusGoogle, type AgendaGoogle } from '@/lib/googleAgenda';

const LEMBRETES = [
  { v: '', l: 'Padrão do Google' }, { v: '0', l: 'Na hora' }, { v: '10', l: '10 min antes' },
  { v: '30', l: '30 min antes' }, { v: '60', l: '1 hora antes' }, { v: '1440', l: '1 dia antes' },
];

const hhmm = (iso: string | null) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '');
const dataLocal = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA') : '');

interface Props {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  item: AgendaItem | null;
  tipoNovo: 'compromisso' | 'tarefa';
  dataNova?: string;
  onSalvar: (i: NovoAgendaItem & { id?: string }) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
}

export function AgendaItemSheet({ aberto, onOpenChange, item, tipoNovo, dataNova, onSalvar, onExcluir }: Props) {
  const { clientes } = useClientes();
  const [tipo, setTipo] = useState<'compromisso' | 'tarefa'>(tipoNovo);
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [hIni, setHIni] = useState('09:00');
  const [hFim, setHFim] = useState('10:00');
  const [lembrete, setLembrete] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [notas, setNotas] = useState('');
  const [busy, setBusy] = useState(false);
  const [lista, setLista] = useState('');
  const [listas, setListas] = useState<{ id: string; nome: string }[]>([]);
  // Agendas do Google para o compromisso ('' = agenda BALANX).
  const [agenda, setAgenda] = useState('');
  const [agendas, setAgendas] = useState<AgendaGoogle[]>([]);
  const [semPermAgendas, setSemPermAgendas] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setAgenda(item?.google_calendar_id || '');
    statusGoogle().then((s) => {
      const ls = listasEscolhidas(s);
      setListas(ls);
      setLista(item?.google_tasklist_id || ls[0]?.id || '');
      setGoogleOn(!!s);
      if (!s) { setAgendas([]); return; }
      agendasGoogle().then((r) => { setAgendas(r.agendas); setSemPermAgendas(r.sem_permissao); }).catch(() => { setAgendas([]); setSemPermAgendas(false); });
    }).catch(() => { setListas([]); setGoogleOn(false); });
  }, [aberto, item]);
  const agendaBalanx = agendas.find((a) => a.balanx)?.id;
  // Agenda escolhida que não aparece mais na lista (apagada/sem acesso) continua visível para não trocar sozinha.
  const agendaSel = agenda && agenda !== agendaBalanx ? agenda : (agendaBalanx || '');

  useEffect(() => {
    if (!aberto) return;
    const t = item?.tipo ?? tipoNovo;
    setTipo(t);
    setTitulo(item?.titulo ?? '');
    setData(item ? (item.data || dataLocal(item.inicio)) : (dataNova || (t === 'compromisso' ? format(new Date(), 'yyyy-MM-dd') : '')));
    setDiaInteiro(item ? item.dia_inteiro || (!item.inicio && t === 'compromisso') : false);
    setHIni(item?.inicio ? hhmm(item.inicio) : '09:00');
    setHFim(item?.fim ? hhmm(item.fim) : item?.inicio ? hhmm(new Date(new Date(item.inicio).getTime() + 3600000).toISOString()) : '10:00');
    setLembrete(item?.lembrete_min != null ? String(item.lembrete_min) : '');
    setClienteId(item?.cliente_id ?? '');
    setNotas(item?.notas ?? '');
  }, [aberto, item, tipoNovo, dataNova]);

  const salvar = async () => {
    if (!titulo.trim()) { toast.error('Dê um título'); return; }
    if (tipo === 'compromisso' && !data) { toast.error('Escolha a data'); return; }
    let dados: NovoAgendaItem;
    // Só grava a agenda quando a lista carregou (sem Google, não mexe no campo).
    const agendaDados = agendas.length ? { google_calendar_id: agendaSel && agendaSel !== agendaBalanx ? agendaSel : null } : {};
    if (tipo === 'tarefa') {
      dados = { tipo, titulo: titulo.trim(), notas: notas.trim() || null, data: data || null, inicio: null, fim: null, dia_inteiro: false, cliente_id: clienteId || null,
        ...(listas.length ? { google_tasklist_id: lista || null } : {}) };
    } else if (diaInteiro) {
      dados = { tipo, titulo: titulo.trim(), notas: notas.trim() || null, data, inicio: null, fim: null, dia_inteiro: true, lembrete_min: lembrete === '' ? null : Number(lembrete), cliente_id: clienteId || null, ...agendaDados };
    } else {
      const ini = new Date(`${data}T${hIni || '09:00'}`);
      let fim = new Date(`${data}T${hFim || hIni}`);
      if (fim <= ini) fim = new Date(ini.getTime() + 3600000);
      dados = { tipo, titulo: titulo.trim(), notas: notas.trim() || null, data: null, inicio: ini.toISOString(), fim: fim.toISOString(), dia_inteiro: false, lembrete_min: lembrete === '' ? null : Number(lembrete), cliente_id: clienteId || null, ...agendaDados };
    }
    setBusy(true);
    try { await onSalvar({ ...dados, id: item?.id }); onOpenChange(false); toast.success(item ? 'Salvo' : tipo === 'tarefa' ? 'Tarefa criada' : 'Compromisso criado'); }
    catch (e) { toast.error('Não salvou', { description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };

  const excluir = async () => {
    if (!item || !window.confirm(`Excluir "${item.titulo}"? Sai também do Google, se estiver conectado.`)) return;
    setBusy(true);
    try { await onExcluir(item.id); onOpenChange(false); toast.success('Excluído'); }
    catch (e) { toast.error('Não excluiu', { description: e instanceof Error ? e.message : '' }); }
    finally { setBusy(false); }
  };

  const cabecalho = item ? (tipo === 'tarefa' ? 'Editar tarefa' : 'Editar compromisso') : tipo === 'tarefa' ? 'Nova tarefa' : 'Novo compromisso';

  return (
    <Sheet open={aberto} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
        <SheetTitle className="sr-only">{cabecalho}</SheetTitle>
        <ModalShell>
          <ModalHeader eyebrow="Agenda" title={cabecalho} onClose={() => !busy && onOpenChange(false)} />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
            {!item && (
              <Segmented<'compromisso' | 'tarefa'> className="w-full" value={tipo} onChange={setTipo} opts={[['compromisso', 'Compromisso'], ['tarefa', 'Tarefa']]} />
            )}
            <section className="space-y-3 rounded-[20px] border border-border bg-surface p-4">
              <Campo label="Título">
                <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campoCls}
                  placeholder={tipo === 'tarefa' ? 'Emitir NF da Sabor Maria' : 'Reunião com a Sabor Maria'} />
              </Campo>
              <DatePickerField label={tipo === 'tarefa' ? 'Data limite (opcional)' : 'Data'} value={data} onChange={setData} />
              {tipo === 'compromisso' && (
                <>
                  <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2/60 px-3.5 py-3">
                    <span className="text-[14px] text-foreground">Dia inteiro</span>
                    <Switch checked={diaInteiro} onCheckedChange={setDiaInteiro} aria-label="Dia inteiro" />
                  </label>
                  {!diaInteiro && (
                    <div className="grid grid-cols-2 gap-3">
                      <Campo label="Início"><input type="time" value={hIni} onChange={(e) => setHIni(e.target.value)} className={campoCls} /></Campo>
                      <Campo label="Fim"><input type="time" value={hFim} onChange={(e) => setHFim(e.target.value)} className={campoCls} /></Campo>
                    </div>
                  )}
                  {googleOn && agendas.length > 0 && (
                    <Campo label="Salvar na agenda" hint={semPermAgendas ? undefined : 'Aparece nessa agenda do seu Google Agenda.'}>
                      <select className={campoCls} value={agendaSel} onChange={(e) => setAgenda(e.target.value)} disabled={semPermAgendas && agendas.length <= 1}>
                        {agendas.map((a) => <option key={a.id} value={a.id}>{a.balanx ? 'BALANX' : a.principal ? `${a.titulo} (principal)` : a.titulo}</option>)}
                        {agenda && agenda !== agendaBalanx && !agendas.some((a) => a.id === agenda) && <option value={agenda}>Agenda atual</option>}
                      </select>
                    </Campo>
                  )}
                  {googleOn && semPermAgendas && (
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-info-bg px-3.5 py-3 text-[12.5px] text-info-fg">
                      <span>Para salvar em outras agendas do Google, autorize de novo a conexão.</span>
                      <button type="button" onClick={() => { conectarGoogle().catch((e) => toast.error('Não deu para conectar', { description: e instanceof Error ? e.message : '' })); }}
                        className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-[12.5px] font-medium text-background">Autorizar</button>
                    </div>
                  )}
                  <Campo label="Lembrete">
                    <select className={campoCls} value={lembrete} onChange={(e) => setLembrete(e.target.value)}>
                      {LEMBRETES.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
                    </select>
                  </Campo>
                </>
              )}
              {tipo === 'tarefa' && listas.length > 1 && (
                <Campo label="Lista no Google Tarefas">
                  <select className={campoCls} value={lista} onChange={(e) => setLista(e.target.value)}>
                    {listas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </Campo>
              )}
            </section>
            <section className="space-y-3 rounded-[20px] border border-border bg-surface p-4">
              <Campo label="Cliente (opcional)">
                <select className={campoCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Nenhum</option>
                  {clientes.filter((c) => c.status === 'ativo' || c.id === clienteId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Notas">
                <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)}
                  className="w-full resize-none rounded-xl border border-input bg-surface-2 px-3 py-2.5 text-[14px] text-foreground outline-none focus:ring-2 focus:ring-ring" />
              </Campo>
            </section>
          </div>
          <ModalFooter left={item ? (
            <button type="button" className={btn.danger} onClick={excluir} disabled={busy}><Trash2 className="h-4 w-4" />Excluir</button>
          ) : undefined}>
            <button type="button" className={btn.outline} onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="button" className={btn.primary} onClick={salvar} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </ModalFooter>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}

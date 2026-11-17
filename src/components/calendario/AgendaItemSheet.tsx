// Criar / editar compromisso ou tarefa.
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { SheetHeading, NATIVE_SELECT_CLS } from '@/components/cobrancas/formParts';
import { cn } from '@/lib/utils';
import { useClientes } from '@/hooks/useClientes';
import type { AgendaItem, NovoAgendaItem } from '@/hooks/useAgenda';

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
    if (tipo === 'tarefa') {
      dados = { tipo, titulo: titulo.trim(), notas: notas.trim() || null, data: data || null, inicio: null, fim: null, dia_inteiro: false, cliente_id: clienteId || null };
    } else if (diaInteiro) {
      dados = { tipo, titulo: titulo.trim(), notas: notas.trim() || null, data, inicio: null, fim: null, dia_inteiro: true, lembrete_min: lembrete === '' ? null : Number(lembrete), cliente_id: clienteId || null };
    } else {
      const ini = new Date(`${data}T${hIni || '09:00'}`);
      let fim = new Date(`${data}T${hFim || hIni}`);
      if (fim <= ini) fim = new Date(ini.getTime() + 3600000);
      dados = { tipo, titulo: titulo.trim(), notas: notas.trim() || null, data: null, inicio: ini.toISOString(), fim: fim.toISOString(), dia_inteiro: false, lembrete_min: lembrete === '' ? null : Number(lembrete), cliente_id: clienteId || null };
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

  return (
    <Sheet open={aberto} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent side="bottom" showHandle className="max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface p-0 sm:mx-auto sm:max-w-[520px]">
        <SheetTitle className="sr-only">{item ? 'Editar' : 'Novo'} {tipo}</SheetTitle>
        <SheetHeading className="px-5 pt-1" eyebrow="Agenda" title={item ? (tipo === 'tarefa' ? 'Editar tarefa' : 'Editar compromisso') : tipo === 'tarefa' ? 'Nova tarefa' : 'Novo compromisso'} />
        <div className="space-y-4 p-5 pt-3">
          {!item && (
            <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-surface-2 p-1">
              {(['compromisso', 'tarefa'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={cn('h-9 rounded-full text-[13px] font-semibold', tipo === t ? 'bg-foreground text-background' : 'text-foreground-muted')}>
                  {t === 'compromisso' ? 'Compromisso' : 'Tarefa'}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ag-titulo">Título</Label>
            <Input id="ag-titulo" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder={tipo === 'tarefa' ? 'Emitir NF da Sabor Maria' : 'Reunião com a Sabor Maria'} />
          </div>
          <DatePickerField label={tipo === 'tarefa' ? 'Data limite (opcional)' : 'Data'} value={data} onChange={setData} />
          {tipo === 'compromisso' && (
            <>
              <label className="flex items-center justify-between rounded-2xl border border-border px-3.5 py-2.5">
                <span className="text-[14px] text-foreground">Dia inteiro</span>
                <Switch checked={diaInteiro} onCheckedChange={setDiaInteiro} />
              </label>
              {!diaInteiro && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="ag-ini">Início</Label><Input id="ag-ini" type="time" value={hIni} onChange={(e) => setHIni(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="ag-fim">Fim</Label><Input id="ag-fim" type="time" value={hFim} onChange={(e) => setHFim(e.target.value)} /></div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="ag-lembrete">Lembrete</Label>
                <select id="ag-lembrete" className={NATIVE_SELECT_CLS} value={lembrete} onChange={(e) => setLembrete(e.target.value)}>
                  {LEMBRETES.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ag-cliente">Cliente (opcional)</Label>
            <select id="ag-cliente" className={NATIVE_SELECT_CLS} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Nenhum</option>
              {clientes.filter((c) => c.status === 'ativo' || c.id === clienteId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-notas">Notas</Label>
            <Textarea id="ag-notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            {item && (
              <Button variant="ghost" className="text-danger-fg" onClick={excluir} disabled={busy} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
            )}
            <Button className="h-11 flex-1 rounded-full font-semibold" onClick={salvar} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Documentos da empresa: contratos, comprovantes, notas… guardados pela IARA ("guarda esse
// contrato") ou aqui. Bucket privado "documentos" ({tenant_id}/{id}.{ext}) + tabela documentos.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileImage, FileSpreadsheet, FileText, FolderOpen, Loader2, Plus, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useActionParam } from '@/hooks/useActionParam';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PageHeader, ModalHeader, ModalFooter, ModalShell, Campo } from '@/components/reskin/kit';
import { btn, campoCls, modalCls } from '@/components/reskin/estilos';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/formatters';
import { toast } from 'sonner';

interface Doc {
  id: string; nome: string; resumo: string | null; path: string; mime: string | null; tamanho: number | null;
  tags: string[]; origem: string; created_at: string; cliente: { nome: string } | null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const ACEITOS = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt';
const MAX = 15 * 1024 * 1024;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tamanhoTxt = (b: number | null) => (!b ? '' : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function Icone({ mime }: { mime: string | null }) {
  const cls = 'h-4 w-4';
  if (mime?.startsWith('image/')) return <FileImage className={cls} />;
  if (mime && /sheet|excel|csv/.test(mime)) return <FileSpreadsheet className={cls} />;
  return <FileText className={cls} />;
}

export default function Documentos() {
  const { activeTenant } = useTenant();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busca, setBusca] = useState('');
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<Doc | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Formulário de novo documento
  const [modal, setModal] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const [resumo, setResumo] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [tagsTxt, setTagsTxt] = useState('');
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await db.from('documentos')
      .select('id, nome, resumo, path, mime, tamanho, tags, origem, created_at, cliente:clientes(nome)')
      .order('created_at', { ascending: false });
    if (error) { setDocs([]); return; }
    setDocs(data as Doc[]);
  }, []);
  useEffect(() => { void carregar(); }, [carregar, activeTenant?.id]);
  useEffect(() => {
    supabase.from('clientes').select('id, nome').order('nome').then(({ data }) => setClientes((data || []) as { id: string; nome: string }[]));
  }, [activeTenant?.id]);

  const novo = () => {
    setArquivo(null); setNome(''); setResumo(''); setClienteId(''); setTagsTxt('');
    setModal(true);
  };
  useActionParam('novo', novo);

  const escolher = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX) { toast.error('Arquivo maior que 15 MB.'); return; }
    setArquivo(f);
    if (!nome.trim()) setNome(f.name.replace(/\.[^.]+$/, ''));
  };

  const salvar = async () => {
    if (!arquivo || !activeTenant?.id) return;
    setSalvando(true);
    try {
      const id = crypto.randomUUID();
      const ext = (arquivo.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${activeTenant.id}/${id}.${ext}`;
      const up = await supabase.storage.from('documentos').upload(path, arquivo, { contentType: arquivo.type || undefined });
      if (up.error) throw up.error;
      const tags = tagsTxt.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);
      const { error } = await db.from('documentos').insert({
        id, tenant_id: activeTenant.id, nome: (nome.trim() || arquivo.name).slice(0, 200), resumo: resumo.trim() || null,
        path, mime: arquivo.type || null, tamanho: arquivo.size, cliente_id: clienteId || null, tags, origem: 'manual',
      });
      if (error) { await supabase.storage.from('documentos').remove([path]); throw error; }
      toast.success('Documento guardado.');
      setModal(false);
      void carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não deu para guardar.');
    } finally {
      setSalvando(false);
    }
  };

  const abrir = async (d: Doc) => {
    // Abre a aba antes (iPhone bloqueia janela aberta depois de um await) e depois aponta para o link.
    const w = window.open('', '_blank');
    setAbrindo(d.id);
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.path, 600);
    setAbrindo(null);
    if (error || !data?.signedUrl) { w?.close(); toast.error('Não deu para abrir o arquivo.'); return; }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setExcluindo(true);
    const { error } = await db.from('documentos').delete().eq('id', excluir.id);
    if (!error) await supabase.storage.from('documentos').remove([excluir.path]);
    setExcluindo(false);
    setExcluir(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Documento excluído.');
    void carregar();
  };

  const filtrados = useMemo(() => {
    const t = norm(busca.trim());
    if (!docs) return [];
    if (!t) return docs;
    return docs.filter((d) => norm(`${d.nome} ${d.resumo || ''} ${(d.tags || []).join(' ')} ${d.cliente?.nome || ''}`).includes(t));
  }, [docs, busca]);

  return (
    <main className="mx-auto w-full max-w-[1180px] space-y-5 py-4 md:py-6">
      <PageHeader eyebrow="Clientes" title="Documentos">
        <button type="button" onClick={novo} className={cn(btn.primary, 'max-sm:hidden')}><Upload className="h-4 w-4" />Guardar documento</button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 w-full items-center gap-2 rounded-full border border-border bg-surface px-3.5 sm:w-96">
          <Search className="h-4 w-4 text-foreground-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, cliente ou conteúdo"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-foreground-muted" />
        </label>
        <p className="flex items-center gap-1.5 text-[12.5px] text-foreground-muted max-sm:px-1">
          <Sparkles className="h-3.5 w-3.5" />Dica: mande o arquivo para a IARA e diga "guarda esse contrato". Para achar: "acha o contrato da X".
        </p>
      </div>

      {docs === null ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[72px] animate-pulse rounded-[20px] border border-border bg-surface" />)}</div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border px-6 py-14 text-center">
          <FolderOpen className="mx-auto h-6 w-6 text-foreground-muted" />
          <p className="mt-2 text-[15px] text-foreground">{busca ? 'Nada encontrado com essa busca.' : 'Nenhum documento guardado ainda.'}</p>
          <p className="mx-auto mt-1 max-w-[420px] text-[13px] text-foreground-muted">Guarde contratos, comprovantes, notas e boletos para achar em segundos, aqui ou pedindo à IARA.</p>
          {!busca && <button type="button" onClick={novo} className={cn(btn.primary, 'mt-4')}><Plus className="h-4 w-4" />Guardar documento</button>}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[24px] border border-border bg-surface">
          {filtrados.map((d) => (
            <li key={d.id} className="flex items-start gap-3 border-t border-border px-4 py-3.5 first:border-t-0">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-foreground-muted"><Icone mime={d.mime} /></span>
              <button type="button" onClick={() => abrir(d)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[14px] font-medium text-foreground">{d.nome}</span>
                {d.resumo && <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-foreground-muted">{d.resumo}</span>}
                <span className="mt-1.5 flex flex-wrap items-center gap-1">
                  {d.cliente?.nome && <span className="rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-medium text-info-fg">{d.cliente.nome}</span>}
                  {(d.tags || []).map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-foreground-muted">{t}</span>)}
                  <span className="text-[11px] text-foreground-subtle">{formatDate(d.created_at.slice(0, 10))}{d.tamanho ? ` · ${tamanhoTxt(d.tamanho)}` : ''}{d.origem === 'iara' ? ' · pela IARA' : ''}</span>
                </span>
              </button>
              <span className="flex shrink-0 items-center">
                <button type="button" onClick={() => abrir(d)} aria-label={`Abrir ${d.nome}`} className="grid h-9 w-9 place-items-center rounded-full text-foreground-muted hover:bg-surface-2 hover:text-foreground">
                  {abrindo === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => setExcluir(d)} aria-label={`Excluir ${d.nome}`} className="grid h-9 w-9 place-items-center rounded-full text-foreground-muted hover:bg-danger-bg hover:text-danger-fg">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={modal} onOpenChange={(o) => { if (!salvando) setModal(o); }}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
          <ModalShell>
            <ModalHeader eyebrow="Documentos" title="Guardar documento" onClose={() => setModal(false)} />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <input ref={inputRef} type="file" accept={ACEITOS} className="hidden" onChange={(e) => escolher(e.target.files?.[0] || null)} />
              <button type="button" onClick={() => inputRef.current?.click()}
                className={cn('flex w-full items-center gap-3 rounded-2xl border border-dashed p-4 text-left transition-colors hover:bg-surface-2/60', arquivo ? 'border-border' : 'border-border-strong')}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-foreground-muted">{arquivo ? <Icone mime={arquivo.type} /> : <Upload className="h-4 w-4" />}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] text-foreground">{arquivo ? arquivo.name : 'Escolher arquivo'}</span>
                  <span className="block text-[12px] text-foreground-muted">{arquivo ? tamanhoTxt(arquivo.size) : 'PDF, foto, Word, Excel ou CSV · até 15 MB'}</span>
                </span>
              </button>
              <Campo label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Contrato Sabor Maria 2026" maxLength={200} /></Campo>
              <Campo label="Cliente (opcional)">
                <select className={campoCls} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Nenhum</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Do que se trata (opcional)" hint="Ajuda a IARA a achar e responder sobre ele">
                <Textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={3} maxLength={2000} placeholder="Ex.: contrato de gestão de tráfego, R$ 2.000/mês, vigência até 12/2026" />
              </Campo>
              <Campo label="Etiquetas (opcional)" hint="Separe por vírgula"><Input value={tagsTxt} onChange={(e) => setTagsTxt(e.target.value)} placeholder="contrato, comprovante" /></Campo>
            </div>
            <ModalFooter>
              <button type="button" className={btn.outline} onClick={() => setModal(false)} disabled={salvando}>Cancelar</button>
              <button type="button" className={btn.primary} onClick={salvar} disabled={!arquivo || salvando}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Guardar
              </button>
            </ModalFooter>
          </ModalShell>
        </SheetContent>
      </Sheet>

      <ConfirmDialog open={!!excluir} onOpenChange={(o) => { if (!o) setExcluir(null); }}
        title="Excluir documento" description={`"${excluir?.nome || ''}" será apagado de vez. Isso não dá para desfazer.`}
        confirmLabel="Excluir" variant="destructive" isLoading={excluindo} onConfirm={confirmarExclusao} />
    </main>
  );
}

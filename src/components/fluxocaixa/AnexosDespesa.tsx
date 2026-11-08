import { useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ANEXO_ACCEPT, MAX_ANEXOS_DESPESA, anexarArquivos, removerAnexo, urlAnexo, type AnexoDespesa,
} from '@/lib/anexosDespesa';

interface Props {
  despesaId: string;
  inicial: AnexoDespesa[];
  /** Avisa a tela para recarregar a lista (ícone de clipe nas linhas). */
  onChange?: () => void;
}

/** Boletos/notas da despesa a pagar: anexar, ver e excluir. Somem quando a despesa é paga. */
export function AnexosDespesa({ despesaId, inicial, onChange }: Props) {
  const [anexos, setAnexos] = useState<AnexoDespesa[]>(inicial);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const escolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setEnviando(true);
    try {
      const { anexos: final, ignorados } = await anexarArquivos(despesaId, files);
      setAnexos(final);
      onChange?.();
      if (ignorados) toast.warning(`Anexados ${files.length - ignorados} de ${files.length}: o limite é ${MAX_ANEXOS_DESPESA} por despesa.`);
      else toast.success(files.length > 1 ? `${files.length} arquivos anexados.` : 'Arquivo anexado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao anexar arquivo');
    } finally {
      setEnviando(false);
    }
  };

  const abrir = async (a: AnexoDespesa) => {
    // Abre a aba antes do await: o Safari bloqueia window.open depois de uma espera.
    const aba = window.open('', '_blank');
    const url = await urlAnexo(a.path);
    if (!url) { aba?.close(); toast.error('Não foi possível abrir o arquivo.'); return; }
    if (aba) aba.location.href = url;
    else window.location.href = url;
  };

  const excluir = async (a: AnexoDespesa) => {
    if (confirmar !== a.path) { setConfirmar(a.path); return; }
    setConfirmar(null);
    setRemovendo(a.path);
    try {
      setAnexos(await removerAnexo(despesaId, a.path));
      onChange?.();
      toast.success('Arquivo excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setRemovendo(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3">
        <div className="text-[12px] text-foreground-muted">Anexos · {anexos.length}/{MAX_ANEXOS_DESPESA}</div>
        <div className="text-[11px] text-foreground-subtle">Somem quando a despesa for paga</div>
      </div>

      {anexos.length > 0 && (
        <ul className="mt-1 px-2">
          {anexos.map((a) => {
            const Icone = a.tipo?.startsWith('image/') ? ImageIcon : FileText;
            const pedindo = confirmar === a.path;
            return (
              <li key={a.path} className="flex items-center gap-1 border-b border-border last:border-b-0">
                <button
                  onClick={() => abrir(a)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
                  title={`Abrir ${a.nome}`}
                >
                  <Icone className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{a.nome}</span>
                </button>
                <button
                  onClick={() => excluir(a)}
                  onBlur={() => pedindo && setConfirmar(null)}
                  disabled={removendo === a.path}
                  aria-label={pedindo ? `Confirmar exclusão de ${a.nome}` : `Excluir ${a.nome}`}
                  className={cn(
                    'no-touch-min inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[12px] font-semibold transition-colors',
                    pedindo ? 'bg-danger-bg text-danger-fg' : 'w-8 text-foreground-muted hover:bg-danger-bg hover:text-danger-fg',
                  )}
                >
                  {removendo === a.path ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {pedindo && 'Excluir?'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="p-3 pt-2">
        {anexos.length < MAX_ANEXOS_DESPESA && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-border-strong text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            {enviando ? 'Enviando…' : anexos.length ? 'Anexar mais um arquivo' : 'Anexar boleto ou nota (PDF ou foto)'}
          </button>
        )}
        <input ref={inputRef} type="file" accept={ANEXO_ACCEPT} multiple className="hidden" onChange={escolher} />
      </div>
    </div>
  );
}

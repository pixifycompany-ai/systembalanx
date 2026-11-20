// O que a IARA devolve além do texto: documentos guardados/encontrados (com link) e
// arquivos gerados (PDF/Excel) para baixar.
import { Link } from 'react-router-dom';
import { Download, ExternalLink, FileCheck2, FileSpreadsheet, FileText, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentoIara } from '@/hooks/useFinancialAdvisor';
import { baixarArquivoIara, type ArquivoIara } from '@/lib/arquivoIara';
import { formatDate } from '@/utils/formatters';

export function DocumentosIara({ docs }: { docs: DocumentoIara[] }) {
  const guardados = docs.filter((d) => d.acao === 'guardado');
  const achados = docs.filter((d) => d.acao === 'encontrado');
  return (
    <div className="mt-2.5 space-y-1.5">
      {guardados.map((d) => (
        <Link key={d.id} to="/documentos" className="flex items-center gap-2 rounded-[14px] bg-success-bg px-3 py-2 text-[12.5px] text-success-fg hover:opacity-90">
          <FileCheck2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate"><b className="font-semibold">Guardei:</b> {d.nome}</span>
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        </Link>
      ))}
      {achados.map((d) => (
        <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
          className="flex items-start gap-2.5 rounded-[14px] border border-border bg-surface px-3 py-2.5 hover:bg-surface-2/60">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-foreground">{d.nome}</span>
            {d.resumo && <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-foreground-muted">{d.resumo}</span>}
            {d.data && <span className="mt-0.5 block text-[11px] text-foreground-subtle">guardado em {formatDate(d.data)}</span>}
          </span>
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground-muted" />
        </a>
      ))}
    </div>
  );
}

export function ArquivosGerados({ arquivos }: { arquivos: ArquivoIara[] }) {
  const baixar = (a: ArquivoIara) => {
    if (!baixarArquivoIara(a)) toast.error('O navegador bloqueou a janela do PDF. Permita pop-ups para o BALANX e toque de novo.');
  };
  return (
    <div className="mt-2.5 space-y-1.5">
      {arquivos.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-[16px] border border-border bg-surface px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-foreground-muted">
            {a.formato === 'excel' ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-[13px] font-semibold leading-snug text-foreground">{a.titulo}</span>
            <span className="block truncate text-[11.5px] text-foreground-muted">{a.subtitulo} · {a.linhas.length} linha{a.linhas.length === 1 ? '' : 's'} · {a.formato === 'excel' ? 'Excel' : 'PDF'}</span>
          </span>
          <button type="button" onClick={() => baixar(a)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[12.5px] font-semibold text-background hover:opacity-90">
            <Download className="h-3.5 w-3.5" />Baixar
          </button>
        </div>
      ))}
    </div>
  );
}

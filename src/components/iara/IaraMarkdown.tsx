// Renderização das respostas da IARA (página e widget da Home): GFM (tabelas,
// listas), estilos compactos e uma rede de segurança para tabelas que o modelo
// às vezes escreve "coladas" numa única linha.
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/** "| a | b | |---|---| | 1 | 2 |" (tudo numa linha) → uma linha por registro. */
function consertarTabelas(md: string): string {
  return md
    .split('\n')
    .map((linha) => {
      const t = linha.trim();
      if (!t.startsWith('|') || !/\|\s+\|/.test(t)) return linha;
      // Só mexe se parecer tabela de verdade (tem a linha separadora |---|).
      if (!/\|\s*:?-{3,}/.test(t)) return linha;
      return t.replace(/\|\s+\|/g, '|\n|');
    })
    .join('\n');
}

export function IaraMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    // Estilo explícito por elemento (o plugin de tipografia não está ativo no app).
    <div className={cn('text-[13px] leading-[1.6] text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node: _node, ...props }) => <p {...props} className="my-2" />,
          strong: ({ node: _node, ...props }) => <strong {...props} className="font-semibold text-foreground" />,
          em: ({ node: _node, ...props }) => <em {...props} className="text-foreground-muted" />,
          ul: ({ node: _node, ...props }) => <ul {...props} className="my-2 space-y-1.5 pl-1" />,
          ol: ({ node: _node, ...props }) => <ol {...props} className="my-2 list-decimal space-y-1.5 pl-5 marker:text-foreground-muted" />,
          li: ({ node: _node, ...props }) => (
            <li
              {...props}
              className="relative pl-4 [ol>&]:pl-1 before:absolute before:left-0.5 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary [ol>&]:before:hidden"
            />
          ),
          h1: ({ node: _node, ...props }) => <p {...props} className="mb-1.5 mt-3 text-[14px] font-semibold" />,
          h2: ({ node: _node, ...props }) => <p {...props} className="mb-1.5 mt-3 text-[13.5px] font-semibold" />,
          h3: ({ node: _node, ...props }) => <p {...props} className="mb-1 mt-3 text-[13px] font-semibold" />,
          a: ({ node: _node, ...props }) => <a {...props} className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" />,
          hr: () => <hr className="my-3 border-border/60" />,
          code: ({ node: _node, ...props }) => <code {...props} className="rounded bg-muted/60 px-1 py-0.5 text-[12px]" />,
          table: ({ node: _node, ...props }) => (
            <div className="-mx-1 my-2 overflow-x-auto rounded-lg border border-border/60">
              <table {...props} className="my-0 w-full text-[12px]" />
            </div>
          ),
          th: ({ node: _node, ...props }) => (
            <th {...props} className="bg-muted/50 px-2.5 py-1.5 text-left font-semibold text-foreground" />
          ),
          td: ({ node: _node, ...props }) => (
            <td {...props} className="border-t border-border/50 px-2.5 py-1.5 tabular-nums" />
          ),
        }}
      >
        {consertarTabelas(content)}
      </ReactMarkdown>
    </div>
  );
}

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

// Classes por tom: 'default' segue o tema; 'navy' é para o bloco navy da Home
// (texto claro, bordas e fundos translúcidos brancos).
const TOM = {
  default: {
    base: 'text-foreground',
    strong: 'text-foreground',
    em: 'text-foreground-muted',
    marker: 'marker:text-foreground-muted',
    dot: 'before:bg-primary',
    link: 'text-primary',
    hr: 'border-border',
    code: 'bg-surface-2',
    tableBorder: 'border-border',
    th: 'bg-surface-2 text-foreground',
    td: 'border-border',
  },
  navy: {
    base: 'text-white',
    strong: 'text-white',
    em: 'text-white/80',
    marker: 'marker:text-white/80',
    dot: 'before:bg-[#7FB0F0]',
    link: 'text-[#9BC0F2]',
    hr: 'border-white/15',
    code: 'bg-white/10',
    tableBorder: 'border-white/15',
    th: 'bg-white/10 text-white',
    td: 'border-white/10',
  },
} as const;

export function IaraMarkdown({ content, className, tone = 'default' }: { content: string; className?: string; tone?: keyof typeof TOM }) {
  const t = TOM[tone];
  return (
    // Estilo explícito por elemento (o plugin de tipografia não está ativo no app).
    <div className={cn('text-[13px] leading-[1.6] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', t.base, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node: _node, ...props }) => <p {...props} className="my-2" />,
          strong: ({ node: _node, ...props }) => <strong {...props} className={cn('font-semibold', t.strong)} />,
          em: ({ node: _node, ...props }) => <em {...props} className={t.em} />,
          ul: ({ node: _node, ...props }) => <ul {...props} className="my-2 space-y-1.5 pl-1" />,
          ol: ({ node: _node, ...props }) => <ol {...props} className={cn('my-2 list-decimal space-y-1.5 pl-5', t.marker)} />,
          li: ({ node: _node, ...props }) => (
            <li
              {...props}
              className={cn(
                'relative pl-4 [ol>&]:pl-1 before:absolute before:left-0.5 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full [ol>&]:before:hidden',
                t.dot,
              )}
            />
          ),
          h1: ({ node: _node, ...props }) => <p {...props} className="mb-1.5 mt-3 text-[14px] font-semibold" />,
          h2: ({ node: _node, ...props }) => <p {...props} className="mb-1.5 mt-3 text-[13.5px] font-semibold" />,
          h3: ({ node: _node, ...props }) => <p {...props} className="mb-1 mt-3 text-[13px] font-semibold" />,
          a: ({ node: _node, ...props }) => <a {...props} className={cn('underline underline-offset-2', t.link)} target="_blank" rel="noreferrer" />,
          hr: () => <hr className={cn('my-3', t.hr)} />,
          code: ({ node: _node, ...props }) => <code {...props} className={cn('rounded px-1 py-0.5 text-[12px]', t.code)} />,
          table: ({ node: _node, ...props }) => (
            <div className={cn('-mx-1 my-2 overflow-x-auto rounded-lg border', t.tableBorder)}>
              <table {...props} className="my-0 w-full text-[12px]" />
            </div>
          ),
          th: ({ node: _node, ...props }) => (
            <th {...props} className={cn('px-2.5 py-1.5 text-left font-semibold', t.th)} />
          ),
          td: ({ node: _node, ...props }) => (
            <td {...props} className={cn('border-t px-2.5 py-1.5 tabular-nums', t.td)} />
          ),
        }}
      >
        {consertarTabelas(content)}
      </ReactMarkdown>
    </div>
  );
}

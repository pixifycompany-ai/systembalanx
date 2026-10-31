import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Hash estável → tom do avatar (tinta sutil da cor da tag; texto sempre foreground).
const TAG_TOKENS = ['tag-blue', 'tag-violet', 'tag-teal', 'tag-amber', 'tag-pink', 'tag-green', 'tag-orange', 'tag-fuchsia'];
function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_TOKENS[h % TAG_TOKENS.length];
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

interface ClienteAvatarProps {
  nome: string;
  /** Quando selecionado (multi-seleção) mostra o check no lugar das iniciais */
  selected?: boolean;
  className?: string;
}

/** Avatar 40×40 de iniciais do cliente (raio 13px). */
export function ClienteAvatar({ nome, selected, className }: ClienteAvatarProps) {
  const tag = colorFromName(nome);
  return (
    <span
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-[13px] text-[13px] font-semibold tracking-[-0.01em] transition-colors',
        selected ? 'bg-foreground text-background' : 'text-foreground',
        className,
      )}
      style={selected ? undefined : { backgroundColor: `hsl(var(--${tag}) / 0.16)` }}
    >
      {selected ? <Check className="h-4 w-4" strokeWidth={2.4} /> : initials(nome)}
    </span>
  );
}

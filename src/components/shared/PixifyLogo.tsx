import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import brandLight from '@/assets/brand-light.svg';
import brandDark from '@/assets/brand-dark.svg';

interface PixifyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Show only the monogram icon, without the "balanx" wordmark. */
  iconOnly?: boolean;
}

const sizeClasses = {
  sm: { icon: 'h-5 w-5', text: 'text-base' },   // Header
  md: { icon: 'h-8 w-8', text: 'text-xl' },     // Default
  lg: { icon: 'h-12 w-12', text: 'text-3xl' },  // Login
};

export function PixifyLogo({ size = 'md', className, iconOnly = false }: PixifyLogoProps) {
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? brandDark : brandLight;
  const s = sizeClasses[size];

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <img src={logoSrc} alt="balanx" className={cn(s.icon, 'rounded-[22%]')} />
      {!iconOnly && (
        <span
          className={cn('lowercase text-foreground leading-none', s.text)}
          style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, letterSpacing: '-0.01em' }}
        >
          balanx
        </span>
      )}
    </span>
  );
}

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Padrão: CLARO (rebranding "BALANX Claro"). O tema salvo só vale se a
    // pessoa ESCOLHEU (flag 'theme_escolhido') — antes o app gravava 'dark'
    // automaticamente pra todo mundo, então o valor antigo não é escolha.
    try {
      const escolheu = localStorage.getItem('theme_escolhido') === '1';
      const stored = localStorage.getItem('theme') as Theme;
      if (escolheu && (stored === 'light' || stored === 'dark')) return stored;
    } catch { /* storage indisponível: usa o padrão */ }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const marcarEscolha = () => {
    try { localStorage.setItem('theme_escolhido', '1'); } catch { /* ignore */ }
  };

  const toggleTheme = () => {
    marcarEscolha();
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (newTheme: Theme) => {
    marcarEscolha();
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

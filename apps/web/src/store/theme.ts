import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Mode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  mode: Mode;
  resolvedTheme: ResolvedTheme;
  toggle: () => void;
  setMode: (mode: Mode) => void;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function resolveTheme(mode: Mode): ResolvedTheme {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      resolvedTheme: 'light',
      toggle: () => {
        const current = get().mode;
        const next: Mode = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
        const resolved = resolveTheme(next);
        applyTheme(resolved);
        set({ mode: next, resolvedTheme: resolved });
      },
      setMode: (mode: Mode) => {
        const resolved = resolveTheme(mode);
        applyTheme(resolved);
        set({ mode, resolvedTheme: resolved });
      },
    }),
    {
      name: 'leadgenius-theme',
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.mode);
          applyTheme(resolved);
          state.resolvedTheme = resolved;
        }
      },
    },
  ),
);

// Listen for system preference changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const { mode } = useThemeStore.getState();
    if (mode === 'system') {
      const resolved = getSystemTheme();
      applyTheme(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  });
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  sidebarCollapsed: boolean;
  darkMode: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  activeFilters: Record<string, Record<string, string>>;
  setActiveFilter: (page: string, key: string, value: string) => void;
  clearFilters: (page: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      darkMode: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode;
          document.documentElement.classList.toggle('dark', next);
          return { darkMode: next };
        }),
      setDarkMode: (dark) => {
        document.documentElement.classList.toggle('dark', dark);
        set({ darkMode: dark });
      },
      activeFilters: {},
      setActiveFilter: (page, key, value) =>
        set((state) => ({
          activeFilters: {
            ...state.activeFilters,
            [page]: { ...state.activeFilters[page], [key]: value },
          },
        })),
      clearFilters: (page) =>
        set((state) => {
          const { [page]: _, ...rest } = state.activeFilters;
          return { activeFilters: rest };
        }),
    }),
    {
      name: 'leadgenius-store',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, darkMode: state.darkMode }),
    },
  ),
);

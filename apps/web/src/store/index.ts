import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  activeFilters: Record<string, Record<string, string>>;
  setActiveFilter: (page: string, key: string, value: string) => void;
  clearFilters: (page: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
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
    { name: 'leadgenius-store', partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }) },
  ),
);

import { useEffect } from 'react';
import Sidebar from './Sidebar';
import { useAppStore } from '../../store';

export default function Layout({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);

  useEffect(() => {
    const stored = useAppStore.getState().darkMode;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ?? prefersDark;
    setDarkMode(isDark);
  }, [setDarkMode]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <main className="flex-1 overflow-auto bg-[var(--color-bg)]">
        <div className="max-w-7xl mx-auto p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}

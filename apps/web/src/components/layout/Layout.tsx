import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import CommandPalette from '../CommandPalette';
import OnboardingWizard from '../onboarding/OnboardingWizard';
import { useAppStore } from '../../store';
import { useAuthStore } from '../../store/auth';
import { useOnboardingStore } from '../../store/onboarding';

export default function Layout({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingComplete = useOnboardingStore((s) => s.isComplete);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Onboarding wizard overlay */}
      {isAuthenticated && !onboardingComplete && <OnboardingWizard />}
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 h-full w-56">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <nav className="text-sm text-gray-500 hidden sm:block">
              <span className="text-gray-900 font-medium">
                {location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2)}
              </span>
            </nav>
          </div>
        </header>

        {/* Main content with page transition */}
        <main className="flex-1 overflow-auto bg-gray-50">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto p-4 md:p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Command Palette overlay */}
      <CommandPalette />
    </div>
  );
}

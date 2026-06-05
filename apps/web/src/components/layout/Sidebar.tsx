import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderOpen, FileText, Send, MessageSquare,
  BarChart3, Settings, Inbox, Bot, Key, Globe, ChevronLeft, ChevronRight,
  LogOut, Moon, Sun, Menu, X,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useAppStore } from '../../store';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/groups', label: 'Groups', icon: FolderOpen },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/campaigns', label: 'Campaigns', icon: Send },
  { path: '/messages', label: 'Messages', icon: MessageSquare },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/inbox', label: 'AI Inbox', icon: Inbox },
  { path: '/agent', label: 'AI Agent', icon: Bot },
  { path: '/api-keys', label: 'API Keys', icon: Key },
  { path: '/webhooks', label: 'Webhooks', icon: Globe },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-[var(--color-sidebar)] text-white shadow-lg"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          flex flex-col bg-[var(--color-sidebar)] text-white transition-all duration-300
          fixed lg:static inset-y-0 left-0 z-50
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'w-16' : 'w-56'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          {!collapsed && <span className="font-bold text-lg tracking-tight">LeadGenius</span>}
          <div className="flex items-center gap-1">
            {!collapsed && (
              <button
                onClick={toggleDarkMode}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            )}
            <button onClick={() => { onToggle(); if (mobileOpen) setMobileOpen(false); }} className="p-1 rounded-lg hover:bg-white/10 transition-colors hidden lg:block">
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors lg:hidden">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--color-primary)]/20 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 space-y-2 shrink-0">
          {collapsed && (
            <button
              onClick={toggleDarkMode}
              className="flex items-center justify-center w-full p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
          {!collapsed && user && (
            <div className="px-3 text-xs text-white/50 truncate">{user.email}</div>
          )}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

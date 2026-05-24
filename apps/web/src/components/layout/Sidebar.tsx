import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderOpen, FileText, Send, MessageSquare,
  BarChart3, Settings, Inbox, Bot, ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';

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
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className={`flex flex-col bg-[var(--color-sidebar)] text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && <span className="font-bold text-lg tracking-tight">LeadGenius</span>}
        <button onClick={onToggle} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3 space-y-2">
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
  );
}

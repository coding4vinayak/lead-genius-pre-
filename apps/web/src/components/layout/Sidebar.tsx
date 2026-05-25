import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderOpen, FileText, Send, MessageSquare,
  BarChart3, Settings, Inbox, Bot, ChevronLeft, ChevronRight, LogOut,
  GitBranch, Plug, ChevronDown, ShieldCheck, Flame, Mail, CreditCard,
  Building2, Link2, FlaskConical, TrendingUp, Target, Key, Linkedin,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { Avatar } from '../ui';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Outreach',
    items: [
      { path: '/leads', label: 'Leads', icon: Users },
      { path: '/sequences', label: 'Sequences', icon: GitBranch },
      { path: '/campaigns', label: 'Campaigns', icon: Send },
      { path: '/templates', label: 'Templates', icon: FileText },
    ],
  },
  {
    title: 'Deliverability',
    items: [
      { path: '/deliverability', label: 'Email Verification', icon: ShieldCheck },
      { path: '/warmup', label: 'Warm-up', icon: Flame },
      { path: '/email-accounts', label: 'Accounts', icon: Mail },
    ],
  },
  {
    title: 'Communication',
    items: [
      { path: '/inbox', label: 'AI Inbox', icon: Inbox },
      { path: '/messages', label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    title: 'Channels',
    items: [
      { path: '/linkedin', label: 'LinkedIn', icon: Linkedin },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/ab-testing', label: 'A/B Tests', icon: FlaskConical },
      { path: '/advanced-analytics', label: 'Advanced Analytics', icon: TrendingUp },
      { path: '/benchmarks', label: 'Benchmarks', icon: Target },
      { path: '/agent', label: 'AI Agent', icon: Bot },
    ],
  },
  {
    title: 'Billing',
    items: [
      { path: '/billing', label: 'Plans', icon: CreditCard },
      { path: '/workspace', label: 'Workspace', icon: Building2 },
    ],
  },
  {
    title: 'System',
    items: [
      { path: '/integrations', label: 'Integrations', icon: Plug },
      { path: '/crm-integrations', label: 'CRM', icon: Link2 },
      { path: '/groups', label: 'Groups', icon: FolderOpen },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    title: 'Developer',
    items: [
      { path: '/api-keys', label: 'API Keys', icon: Key },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className={`flex flex-col bg-[var(--color-sidebar)] text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && <span className="font-bold text-lg tracking-tight">LeadGenius</span>}
        <button onClick={onToggle} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="mb-2">
            {!collapsed && (
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors"
              >
                <span>{section.title}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${collapsedSections[section.title] ? '-rotate-90' : ''}`} />
              </button>
            )}
            {!collapsedSections[section.title] && (
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-white/15 text-white border-l-2 border-white'
                          : 'text-white/60 hover:bg-white/10 hover:text-white border-l-2 border-transparent'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon size={20} className="shrink-0" />
                      {!collapsed && (
                        <span className="flex-1">{item.label}</span>
                      )}
                      {!collapsed && item.badge !== undefined && item.badge > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3 space-y-2">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-3 py-2">
            <Avatar name={user.name || user.email} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80 truncate">{user.name || 'User'}</p>
              <p className="text-xs text-white/50 truncate">{user.email}</p>
            </div>
          </div>
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

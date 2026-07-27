import {
  LayoutDashboard, Users, GitBranch, Send, FileText, ShieldCheck, Flame, Mail,
  Inbox, MessageSquare, Linkedin, BarChart3, FlaskConical, TrendingUp, Target,
  Bot, CreditCard, Building2, Plug, Link2, UserCog, FolderOpen, Settings, Key,
  Plus, Upload, type LucideIcon,
} from 'lucide-react';

export interface CommandPaletteItem {
  id: string;
  label: string;
  category: 'Pages' | 'Actions' | 'Recent';
  icon: LucideIcon;
  action: { type: 'navigate'; path: string } | { type: 'callback'; fn: () => void };
}

export const pageItems: CommandPaletteItem[] = [
  { id: 'page-dashboard', label: 'Dashboard', category: 'Pages', icon: LayoutDashboard, action: { type: 'navigate', path: '/' } },
  { id: 'page-leads', label: 'Leads', category: 'Pages', icon: Users, action: { type: 'navigate', path: '/leads' } },
  { id: 'page-sequences', label: 'Sequences', category: 'Pages', icon: GitBranch, action: { type: 'navigate', path: '/sequences' } },
  { id: 'page-campaigns', label: 'Campaigns', category: 'Pages', icon: Send, action: { type: 'navigate', path: '/campaigns' } },
  { id: 'page-templates', label: 'Templates', category: 'Pages', icon: FileText, action: { type: 'navigate', path: '/templates' } },
  { id: 'page-deliverability', label: 'Email Verification', category: 'Pages', icon: ShieldCheck, action: { type: 'navigate', path: '/deliverability' } },
  { id: 'page-warmup', label: 'Warm-up', category: 'Pages', icon: Flame, action: { type: 'navigate', path: '/warmup' } },
  { id: 'page-email-accounts', label: 'Accounts', category: 'Pages', icon: Mail, action: { type: 'navigate', path: '/email-accounts' } },
  { id: 'page-inbox', label: 'AI Inbox', category: 'Pages', icon: Inbox, action: { type: 'navigate', path: '/inbox' } },
  { id: 'page-messages', label: 'Messages', category: 'Pages', icon: MessageSquare, action: { type: 'navigate', path: '/messages' } },
  { id: 'page-linkedin', label: 'LinkedIn', category: 'Pages', icon: Linkedin, action: { type: 'navigate', path: '/linkedin' } },
  { id: 'page-analytics', label: 'Analytics', category: 'Pages', icon: BarChart3, action: { type: 'navigate', path: '/analytics' } },
  { id: 'page-ab-testing', label: 'A/B Tests', category: 'Pages', icon: FlaskConical, action: { type: 'navigate', path: '/ab-testing' } },
  { id: 'page-advanced-analytics', label: 'Advanced Analytics', category: 'Pages', icon: TrendingUp, action: { type: 'navigate', path: '/advanced-analytics' } },
  { id: 'page-benchmarks', label: 'Benchmarks', category: 'Pages', icon: Target, action: { type: 'navigate', path: '/benchmarks' } },
  { id: 'page-agent', label: 'AI Agent', category: 'Pages', icon: Bot, action: { type: 'navigate', path: '/agent' } },
  { id: 'page-billing', label: 'Plans', category: 'Pages', icon: CreditCard, action: { type: 'navigate', path: '/billing' } },
  { id: 'page-workspace', label: 'Workspace', category: 'Pages', icon: Building2, action: { type: 'navigate', path: '/workspace' } },
  { id: 'page-integrations', label: 'Integrations', category: 'Pages', icon: Plug, action: { type: 'navigate', path: '/integrations' } },
  { id: 'page-crm-integrations', label: 'CRM', category: 'Pages', icon: Link2, action: { type: 'navigate', path: '/crm-integrations' } },
  { id: 'page-assignment-rules', label: 'Assignment Rules', category: 'Pages', icon: UserCog, action: { type: 'navigate', path: '/assignment-rules' } },
  { id: 'page-groups', label: 'Groups', category: 'Pages', icon: FolderOpen, action: { type: 'navigate', path: '/groups' } },
  { id: 'page-settings', label: 'Settings', category: 'Pages', icon: Settings, action: { type: 'navigate', path: '/settings' } },
  { id: 'page-api-keys', label: 'API Keys', category: 'Pages', icon: Key, action: { type: 'navigate', path: '/api-keys' } },
];

export const actionItems: CommandPaletteItem[] = [
  { id: 'action-new-campaign', label: 'Create new campaign', category: 'Actions', icon: Plus, action: { type: 'navigate', path: '/campaigns' } },
  { id: 'action-import-leads', label: 'Import leads', category: 'Actions', icon: Upload, action: { type: 'navigate', path: '/leads' } },
  { id: 'action-open-settings', label: 'Open settings', category: 'Actions', icon: Settings, action: { type: 'navigate', path: '/settings' } },
  { id: 'action-new-template', label: 'Create new template', category: 'Actions', icon: Plus, action: { type: 'navigate', path: '/templates' } },
  { id: 'action-new-sequence', label: 'Create new sequence', category: 'Actions', icon: Plus, action: { type: 'navigate', path: '/sequences' } },
  { id: 'action-new-lead', label: 'Create new lead', category: 'Actions', icon: Plus, action: { type: 'navigate', path: '/leads' } },
];

export const allItems: CommandPaletteItem[] = [...pageItems, ...actionItems];

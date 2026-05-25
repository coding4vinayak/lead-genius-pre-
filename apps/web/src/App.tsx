import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AuthGuard from './components/auth/AuthGuard';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Groups from './pages/Groups';
import Templates from './pages/Templates';
import Campaigns from './pages/Campaigns';
import Messages from './pages/Messages';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import AiInbox from './pages/AiInbox';
import Agent from './pages/Agent';
import Sequences from './pages/Sequences';
import Integrations from './pages/Integrations';
import Deliverability from './pages/Deliverability';
import EmailAccounts from './pages/EmailAccounts';
import Warmup from './pages/Warmup';
import Billing from './pages/Billing';
import Workspace from './pages/Workspace';
import CrmIntegrations from './pages/CrmIntegrations';
import AbTesting from './pages/AbTesting';
import AdvancedAnalytics from './pages/AdvancedAnalytics';
import Benchmarks from './pages/Benchmarks';
import Login from './pages/Login';
import Signup from './pages/Signup';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/*" element={
        <AuthGuard>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/sequences" element={<Sequences />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/inbox" element={<AiInbox />} />
              <Route path="/agent" element={<Agent />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/deliverability" element={<Deliverability />} />
              <Route path="/email-accounts" element={<EmailAccounts />} />
              <Route path="/warmup" element={<Warmup />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/workspace" element={<Workspace />} />
              <Route path="/crm-integrations" element={<CrmIntegrations />} />
              <Route path="/ab-testing" element={<AbTesting />} />
              <Route path="/advanced-analytics" element={<AdvancedAnalytics />} />
              <Route path="/benchmarks" element={<Benchmarks />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </AuthGuard>
      } />
    </Routes>
  );
}

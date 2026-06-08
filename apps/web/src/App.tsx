import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
import ApiKeys from './pages/ApiKeys';
import Webhooks from './pages/Webhooks';
import Pipeline from './pages/Pipeline';
import Login from './pages/Login';
import Signup from './pages/Signup';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<AnimatedPage><Login /></AnimatedPage>} />
        <Route path="/signup" element={<AnimatedPage><Signup /></AnimatedPage>} />
        <Route path="/*" element={
          <AuthGuard>
            <Layout>
              <AnimatePresence mode="wait">
                <Routes>
                  <Route path="/" element={<AnimatedPage key="dashboard"><Dashboard /></AnimatedPage>} />
                  <Route path="/leads" element={<AnimatedPage key="leads"><Leads /></AnimatedPage>} />
                  <Route path="/groups" element={<AnimatedPage key="groups"><Groups /></AnimatedPage>} />
                  <Route path="/templates" element={<AnimatedPage key="templates"><Templates /></AnimatedPage>} />
                  <Route path="/campaigns" element={<AnimatedPage key="campaigns"><Campaigns /></AnimatedPage>} />
                  <Route path="/messages" element={<AnimatedPage key="messages"><Messages /></AnimatedPage>} />
                  <Route path="/analytics" element={<AnimatedPage key="analytics"><Analytics /></AnimatedPage>} />
                  <Route path="/settings" element={<AnimatedPage key="settings"><Settings /></AnimatedPage>} />
                  <Route path="/api-keys" element={<AnimatedPage key="api-keys"><ApiKeys /></AnimatedPage>} />
                  <Route path="/webhooks" element={<AnimatedPage key="webhooks"><Webhooks /></AnimatedPage>} />
                  <Route path="/pipeline" element={<AnimatedPage key="pipeline"><Pipeline /></AnimatedPage>} />
                  <Route path="/inbox" element={<AnimatedPage key="inbox"><AiInbox /></AnimatedPage>} />
                  <Route path="/agent" element={<AnimatedPage key="agent"><Agent /></AnimatedPage>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AnimatePresence>
            </Layout>
          </AuthGuard>
        } />
      </Routes>
    </AnimatePresence>
  );
}

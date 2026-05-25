import { useState } from 'react';
import { Rocket, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../../ui';
import { useOnboardingStore } from '../../../store/onboarding';

function Confetti() {
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 600,
    y: -(Math.random() * 400 + 100),
    rotate: Math.random() * 720 - 360,
    color: colors[i % colors.length],
    delay: Math.random() * 0.3,
    size: Math.random() * 8 + 4,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-sm"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: p.y, rotate: p.rotate, opacity: 0 }}
          transition={{ duration: 1.5, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

export default function LaunchStep() {
  const { completedSteps, workspaceName, completeStep, completeOnboarding } = useOnboardingStore();
  const [launched, setLaunched] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleLaunch = () => {
    setLaunched(true);
    setShowConfetti(true);
    completeStep('launch');
    setTimeout(() => {
      completeOnboarding();
    }, 2000);
  };

  return (
    <div className="max-w-md mx-auto text-center">
      {showConfetti && <Confetti />}

      <div className="w-16 h-16 bg-[var(--color-primary-50)] rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Rocket className="text-[var(--color-primary)]" size={32} />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Launch!</h2>
      <p className="text-gray-500 mb-8">Here's a summary of your setup</p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green-500" />
          <span className="text-sm text-gray-700">Workspace: {workspaceName || 'Not set'}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className={completedSteps.includes('email') ? 'text-green-500' : 'text-gray-300'} />
          <span className="text-sm text-gray-700">Email connected</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className={completedSteps.includes('leads') ? 'text-green-500' : 'text-gray-300'} />
          <span className="text-sm text-gray-700">Leads imported</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className={completedSteps.includes('template') ? 'text-green-500' : 'text-gray-300'} />
          <span className="text-sm text-gray-700">Template created</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className={completedSteps.includes('sequence') ? 'text-green-500' : 'text-gray-300'} />
          <span className="text-sm text-gray-700">Sequence configured</span>
        </div>
      </div>

      <Button
        onClick={handleLaunch}
        disabled={launched}
        size="lg"
        className="w-full"
      >
        {launched ? 'Launched!' : 'Activate Sequence'}
      </Button>
    </div>
  );
}

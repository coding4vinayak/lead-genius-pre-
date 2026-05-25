import { Input } from '../../ui';
import { useOnboardingStore } from '../../../store/onboarding';
import { Sparkles } from 'lucide-react';

export default function WelcomeStep() {
  const workspaceName = useOnboardingStore((s) => s.workspaceName);
  const setWorkspaceName = useOnboardingStore((s) => s.setWorkspaceName);

  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto">
      <div className="w-16 h-16 bg-[var(--color-primary-50)] rounded-2xl flex items-center justify-center mb-6">
        <Sparkles className="text-[var(--color-primary)]" size={32} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to LeadGenius</h2>
      <p className="text-gray-500 mb-8">
        Let's get your workspace set up in just a few steps. You'll be sending your first campaign in no time.
      </p>
      <div className="w-full">
        <Input
          label="Workspace Name"
          placeholder="e.g. Acme Corp"
          value={workspaceName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWorkspaceName(e.target.value)}
        />
      </div>
    </div>
  );
}

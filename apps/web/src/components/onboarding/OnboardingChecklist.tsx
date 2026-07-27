import { CheckCircle, Circle } from 'lucide-react';
import { Card, ProgressBar } from '../ui';
import { useOnboardingStore, ONBOARDING_STEPS } from '../../store/onboarding';

export default function OnboardingChecklist() {
  const { completedSteps, isComplete, goToStep, resetOnboarding } = useOnboardingStore();

  if (isComplete && completedSteps.length === ONBOARDING_STEPS.length) return null;

  const completedCount = completedSteps.length;
  const totalCount = ONBOARDING_STEPS.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  const handleItemClick = (index: number) => {
    const step = ONBOARDING_STEPS[index];
    if (!completedSteps.includes(step.id)) {
      goToStep(index);
      // Re-open the wizard by marking as not complete
      if (useOnboardingStore.getState().isComplete) {
        resetOnboarding();
        goToStep(index);
      }
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Setup Progress</h3>
        <span className="text-xs text-gray-500">{percentage}% complete</span>
      </div>
      <ProgressBar value={completedCount} max={totalCount} className="mb-4" />
      <div className="space-y-2">
        {ONBOARDING_STEPS.map((step, index) => {
          const done = completedSteps.includes(step.id);
          return (
            <button
              key={step.id}
              onClick={() => handleItemClick(index)}
              className="flex items-center gap-2 w-full text-left p-1.5 rounded hover:bg-gray-50 transition-colors"
            >
              {done ? (
                <CheckCircle size={16} className="text-green-500 shrink-0" />
              ) : (
                <Circle size={16} className="text-gray-300 shrink-0" />
              )}
              <span className={`text-sm ${done ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

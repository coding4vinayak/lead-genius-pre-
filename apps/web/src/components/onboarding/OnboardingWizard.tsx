import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { Button, ProgressBar } from '../ui';
import { useOnboardingStore, ONBOARDING_STEPS } from '../../store/onboarding';
import WelcomeStep from './steps/WelcomeStep';
import ConnectEmailStep from './steps/ConnectEmailStep';
import ImportLeadsStep from './steps/ImportLeadsStep';
import CreateTemplateStep from './steps/CreateTemplateStep';
import CreateSequenceStep from './steps/CreateSequenceStep';
import LaunchStep from './steps/LaunchStep';

const STEP_COMPONENTS = [
  WelcomeStep,
  ConnectEmailStep,
  ImportLeadsStep,
  CreateTemplateStep,
  CreateSequenceStep,
  LaunchStep,
];

export default function OnboardingWizard() {
  const { currentStep, nextStep, prevStep, skipStep, completeStep, isComplete } = useOnboardingStore();

  if (isComplete) return null;

  const StepComponent = STEP_COMPONENTS[currentStep];
  const totalSteps = ONBOARDING_STEPS.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    // Mark current step's id as completed on next
    completeStep(ONBOARDING_STEPS[currentStep].id);
    nextStep();
  };

  const handleSkip = () => {
    skipStep();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-surface)] flex flex-col" data-testid="onboarding-wizard">
      {/* Progress header */}
      <div className="shrink-0 px-6 py-4 border-b border-[var(--color-border)]">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]" data-testid="step-indicator">
              Step {currentStep + 1} of {totalSteps}
            </span>
            {!isLastStep && (
              <button
                onClick={handleSkip}
                className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                data-testid="skip-button"
              >
                <SkipForward size={14} />
                Skip
              </button>
            )}
          </div>
          <ProgressBar value={currentStep + 1} max={totalSteps} data-testid="progress-bar" />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto py-12 px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <StepComponent />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation footer */}
      <div className="shrink-0 px-6 py-4 border-t border-[var(--color-border)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={isFirstStep}
            data-testid="back-button"
          >
            <ChevronLeft size={16} className="mr-1" />
            Back
          </Button>
          {!isLastStep && (
            <Button onClick={handleNext} data-testid="next-button">
              Next
              <ChevronRight size={16} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

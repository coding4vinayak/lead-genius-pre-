import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  isComplete: boolean;
  currentStep: number;
  completedSteps: string[];
  workspaceName: string;
  nextStep: () => void;
  prevStep: () => void;
  skipStep: () => void;
  completeStep: (stepId: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setWorkspaceName: (name: string) => void;
  goToStep: (step: number) => void;
}

export const ONBOARDING_STEPS = [
  { id: 'welcome', label: 'Workspace Name' },
  { id: 'email', label: 'Connect Email' },
  { id: 'leads', label: 'Import Leads' },
  { id: 'template', label: 'Create Template' },
  { id: 'sequence', label: 'Create Sequence' },
  { id: 'launch', label: 'Launch' },
] as const;

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      isComplete: false,
      currentStep: 0,
      completedSteps: [],
      workspaceName: '',
      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, ONBOARDING_STEPS.length - 1),
        })),
      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(state.currentStep - 1, 0),
        })),
      skipStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, ONBOARDING_STEPS.length - 1),
        })),
      completeStep: (stepId: string) =>
        set((state) => ({
          completedSteps: state.completedSteps.includes(stepId)
            ? state.completedSteps
            : [...state.completedSteps, stepId],
        })),
      completeOnboarding: () =>
        set({ isComplete: true, currentStep: 0 }),
      resetOnboarding: () =>
        set({ isComplete: false, currentStep: 0, completedSteps: [], workspaceName: '' }),
      setWorkspaceName: (name: string) => set({ workspaceName: name }),
      goToStep: (step: number) => set({ currentStep: step }),
    }),
    {
      name: 'leadgenius-onboarding',
      partialize: (state) => ({
        isComplete: state.isComplete,
        completedSteps: state.completedSteps,
        workspaceName: state.workspaceName,
      }),
    },
  ),
);

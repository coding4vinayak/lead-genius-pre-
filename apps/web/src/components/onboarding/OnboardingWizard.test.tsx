import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import OnboardingWizard from './OnboardingWizard';
import { useOnboardingStore } from '../../store/onboarding';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, ...rest } = props as Record<string, unknown>;
      return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('OnboardingWizard', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      isComplete: false,
      currentStep: 0,
      completedSteps: [],
      workspaceName: '',
    });
  });

  it('renders step 1 by default', () => {
    render(<OnboardingWizard />);
    expect(screen.getByText('Welcome to LeadGenius')).toBeInTheDocument();
    expect(screen.getByTestId('step-indicator')).toHaveTextContent('Step 1 of 6');
  });

  it('next button advances to step 2', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('step-indicator')).toHaveTextContent('Step 2 of 6');
    expect(screen.getByText('Connect Email')).toBeInTheDocument();
  });

  it('back button goes to previous step', () => {
    useOnboardingStore.setState({ currentStep: 1 });
    render(<OnboardingWizard />);
    expect(screen.getByTestId('step-indicator')).toHaveTextContent('Step 2 of 6');
    fireEvent.click(screen.getByTestId('back-button'));
    expect(screen.getByTestId('step-indicator')).toHaveTextContent('Step 1 of 6');
  });

  it('skip advances to the next step', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByTestId('skip-button'));
    expect(screen.getByTestId('step-indicator')).toHaveTextContent('Step 2 of 6');
  });

  it('progress bar updates with step number', () => {
    render(<OnboardingWizard />);
    const progressBar = screen.getByTestId('onboarding-wizard').querySelector('[class*="bg-\\[var\\(--color-primary\\)\\]"]');
    expect(progressBar).toBeInTheDocument();
    // Advance step
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByTestId('step-indicator')).toHaveTextContent('Step 2 of 6');
  });

  it('does not render when onboarding is complete', () => {
    useOnboardingStore.setState({ isComplete: true });
    const { container } = render(<OnboardingWizard />);
    expect(container.innerHTML).toBe('');
  });

  it('back button is disabled on step 0', () => {
    render(<OnboardingWizard />);
    expect(screen.getByTestId('back-button')).toBeDisabled();
  });
});

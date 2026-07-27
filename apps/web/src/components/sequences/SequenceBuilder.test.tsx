import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SequenceBuilder from './SequenceBuilder';
import type { SequenceStep } from '../../hooks/useSequenceBuilder';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props;
      return <div {...rest}>{children as React.ReactNode}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockSteps: SequenceStep[] = [
  {
    id: 'step_1',
    type: 'send_email',
    title: 'Welcome Email',
    config: { subject: 'Hello!' },
    status: 'completed',
    stats: { sent: 150, openRate: 42 },
    order: 0,
  },
  {
    id: 'step_2',
    type: 'delay',
    title: 'Wait 2 days',
    config: { delay: 2, delayUnit: 'days' },
    status: 'active',
    stats: { sent: 0, openRate: 0 },
    order: 1,
  },
  {
    id: 'step_3',
    type: 'condition',
    title: 'Email Opened?',
    config: { field: 'email_opened', operator: 'equals', value: 'true' },
    status: 'pending',
    stats: { sent: 0, openRate: 0 },
    order: 2,
  },
];

describe('SequenceBuilder', () => {
  it('renders the builder container', () => {
    render(<SequenceBuilder initialSteps={[]} />);
    expect(screen.getByTestId('sequence-builder')).toBeInTheDocument();
  });

  it('renders nodes for each step', () => {
    render(<SequenceBuilder initialSteps={mockSteps} />);
    expect(screen.getByTestId('sequence-node-step_1')).toBeInTheDocument();
    expect(screen.getByTestId('sequence-node-step_2')).toBeInTheDocument();
    expect(screen.getByTestId('sequence-node-step_3')).toBeInTheDocument();
  });

  it('renders step titles correctly', () => {
    render(<SequenceBuilder initialSteps={mockSteps} />);
    expect(screen.getByText('Welcome Email')).toBeInTheDocument();
    expect(screen.getByText('Wait 2 days')).toBeInTheDocument();
    expect(screen.getByText('Email Opened?')).toBeInTheDocument();
  });

  it('renders add step buttons', () => {
    render(<SequenceBuilder initialSteps={mockSteps} />);
    const addButtons = screen.getAllByTestId('add-step-button');
    // One add button after each node
    expect(addButtons.length).toBe(mockSteps.length);
  });

  it('clicking add-step button shows the type dropdown', async () => {
    const user = userEvent.setup();
    render(<SequenceBuilder initialSteps={mockSteps} />);
    const addButtons = screen.getAllByTestId('add-step-button');
    await user.click(addButtons[0]);
    expect(screen.getByTestId('step-type-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Send Email')).toBeInTheDocument();
    expect(screen.getByText('Delay')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
  });

  it('clicking a node opens the config panel', async () => {
    const user = userEvent.setup();
    render(<SequenceBuilder initialSteps={mockSteps} />);
    await user.click(screen.getByTestId('sequence-node-step_1'));
    expect(screen.getByTestId('step-config-panel')).toBeInTheDocument();
    expect(screen.getByText('Configure Step')).toBeInTheDocument();
  });

  it('renders zoom controls', () => {
    render(<SequenceBuilder initialSteps={mockSteps} />);
    expect(screen.getByTestId('zoom-controls')).toBeInTheDocument();
  });

  it('shows step stats overlay', () => {
    render(<SequenceBuilder initialSteps={mockSteps} />);
    expect(screen.getByText('Sent: 150')).toBeInTheDocument();
    expect(screen.getByText('Open: 42%')).toBeInTheDocument();
  });

  it('renders empty state add button when no steps', () => {
    render(<SequenceBuilder initialSteps={[]} />);
    const addButtons = screen.getAllByTestId('add-step-button');
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('adds a new step when type is selected from dropdown', async () => {
    const user = userEvent.setup();
    render(<SequenceBuilder initialSteps={mockSteps} />);
    const addButtons = screen.getAllByTestId('add-step-button');
    await user.click(addButtons[0]);
    await user.click(screen.getByText('Send WhatsApp'));
    expect(screen.getByText('Send WhatsApp')).toBeInTheDocument();
  });
});

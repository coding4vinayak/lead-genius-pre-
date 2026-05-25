import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TemplateEditor from '../../pages/TemplateEditor';
import { checkSpam, getScoreColor, getScoreBarColor } from '../../lib/spamChecker';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Mock api
vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: null } }),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('TemplateEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders split pane layout with editor and preview', () => {
    renderWithProviders(<TemplateEditor />);

    expect(screen.getByPlaceholderText('Template name...')).toBeInTheDocument();
    expect(screen.getByTestId('template-body-input')).toBeInTheDocument();
    expect(screen.getByTestId('preview-container')).toBeInTheDocument();
  });

  it('updates preview in real-time as user types', async () => {
    renderWithProviders(<TemplateEditor />);

    const textarea = screen.getByTestId('template-body-input');
    fireEvent.change(textarea, { target: { value: 'Hello {{name}}' } });

    // Preview should show the rendered content with sample data
    await waitFor(() => {
      const previewContainer = screen.getByTestId('preview-container');
      expect(previewContainer.textContent).toContain('Hello John Smith');
    });
  });

  it('inserts variable at cursor position', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplateEditor />);

    // Click the Insert Variable button
    const insertBtn = screen.getByText('Insert Variable');
    await user.click(insertBtn);

    // Click a variable
    const nameVar = screen.getByText(/\{\{name\}\}/);
    await user.click(nameVar);

    const textarea = screen.getByTestId('template-body-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('{{name}}');
  });

  it('updates spam score as content changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplateEditor />);

    const textarea = screen.getByTestId('template-body-input');
    await user.type(textarea, 'Act now! This is a limited time offer. Click here for free stuff!');

    await waitFor(() => {
      expect(screen.getByText(/\/100/)).toBeInTheDocument();
    });
  });

  it('shows character and word count', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplateEditor />);

    const textarea = screen.getByTestId('template-body-input');
    await user.type(textarea, 'Hello world');

    await waitFor(() => {
      expect(screen.getByText(/11 characters/)).toBeInTheDocument();
      expect(screen.getByText(/2 words/)).toBeInTheDocument();
    });
  });

  it('toggles device preview width', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TemplateEditor />);

    const mobileBtn = screen.getByTitle('Mobile view');
    await user.click(mobileBtn);

    const previewContainer = screen.getByTestId('preview-container');
    expect(previewContainer.className).toContain('w-[375px]');

    const desktopBtn = screen.getByTitle('Desktop view');
    await user.click(desktopBtn);

    expect(previewContainer.className).toContain('w-full');
  });
});

describe('spamChecker', () => {
  it('returns score 0 for clean text', () => {
    const result = checkSpam('Hello, I wanted to follow up on our meeting.');
    expect(result.score).toBe(0);
    expect(result.flaggedWords).toHaveLength(0);
    expect(result.label).toBe('Low Risk');
  });

  it('flags spam words and returns a positive score', () => {
    const result = checkSpam('Act now! This is free and urgent!');
    expect(result.score).toBeGreaterThan(0);
    expect(result.flaggedWords.length).toBeGreaterThan(0);
    expect(result.flaggedWords.some((fw) => fw.word.toLowerCase() === 'free')).toBe(true);
    expect(result.flaggedWords.some((fw) => fw.word.toLowerCase() === 'urgent')).toBe(true);
  });

  it('returns High Risk for heavily spammy text', () => {
    const result = checkSpam('FREE! Act now! Limited time! Click here! Buy now! Urgent! Winner!');
    expect(result.score).toBeGreaterThan(60);
    expect(result.label).toBe('High Risk');
  });

  it('getScoreColor returns correct colors', () => {
    expect(getScoreColor(10)).toBe('text-green-600');
    expect(getScoreColor(45)).toBe('text-yellow-600');
    expect(getScoreColor(75)).toBe('text-red-600');
  });

  it('getScoreBarColor returns correct colors', () => {
    expect(getScoreBarColor(10)).toBe('bg-green-500');
    expect(getScoreBarColor(45)).toBe('bg-yellow-500');
    expect(getScoreBarColor(75)).toBe('bg-red-500');
  });
});

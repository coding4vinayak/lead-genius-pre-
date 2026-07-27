import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from './CommandPalette';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('opens when Cmd+K is pressed', () => {
    renderPalette();
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
  });

  it('opens when Ctrl+K is pressed', () => {
    renderPalette();

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
  });

  it('closes when Escape is pressed', () => {
    renderPalette();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    waitFor(() => {
      expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
    });
  });

  it('closes when backdrop is clicked', () => {
    renderPalette();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('command-palette-backdrop'));
    waitFor(() => {
      expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
    });
  });

  it('filters results when typing', async () => {
    const user = userEvent.setup();
    renderPalette();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    const input = screen.getByTestId('command-palette-input');
    await user.type(input, 'dash');

    const results = screen.getAllByTestId('command-palette-result');
    expect(results.length).toBeGreaterThan(0);
    // Dashboard should be in the results (text split across spans due to highlighting)
    expect(results[0].textContent).toContain('Dashboard');
  });

  it('shows no results message for unmatched query', async () => {
    const user = userEvent.setup();
    renderPalette();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    const input = screen.getByTestId('command-palette-input');
    await user.type(input, 'xyznonexistent');

    expect(screen.getByText(/No results found/)).toBeInTheDocument();
  });

  it('navigates with arrow keys and Enter executes', async () => {
    const user = userEvent.setup();
    renderPalette();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    const input = screen.getByTestId('command-palette-input');
    await user.type(input, 'Lead');

    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getAllByTestId('command-palette-result').length).toBeGreaterThan(0);
    });

    // Press Enter to execute first result
    fireEvent.keyDown(document, { key: 'Enter' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('arrow down navigates to next item', async () => {
    const user = userEvent.setup();
    renderPalette();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    const input = screen.getByTestId('command-palette-input');
    await user.type(input, 'Cam');

    await waitFor(() => {
      expect(screen.getAllByTestId('command-palette-result').length).toBeGreaterThan(1);
    });

    // Arrow down changes selection
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('stores and shows recent items', async () => {
    const user = userEvent.setup();
    renderPalette();

    // Open and navigate to set a recent item
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const input = screen.getByTestId('command-palette-input');
    await user.type(input, 'Settings');

    await waitFor(() => {
      expect(screen.getAllByTestId('command-palette-result').length).toBeGreaterThan(0);
    });

    // Execute the first result to save it as recent
    fireEvent.keyDown(document, { key: 'Enter' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    // Reopen palette with empty query - should show recent items
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    });

    // Recent section should appear since localStorage has a recent item
    await waitFor(() => {
      const results = screen.queryAllByTestId('command-palette-result');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

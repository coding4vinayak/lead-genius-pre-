import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from './index';

describe('Modal', () => {
  it('should render when open', () => {
    render(<Modal isOpen={true} onClose={() => {}} title="Test Modal">Content</Modal>);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<Modal isOpen={false} onClose={() => {}} title="Hidden">Content</Modal>);
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('should render close button', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="Test">Content</Modal>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

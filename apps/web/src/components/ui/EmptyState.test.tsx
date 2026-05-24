import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState, Button } from './index';

describe('EmptyState', () => {
  it('should render title and description', () => {
    render(<EmptyState title="No data" description="Nothing here yet" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('should render action button when provided', () => {
    render(
      <EmptyState
        title="No leads"
        description="Add your first lead"
        action={<Button>Add Lead</Button>}
      />,
    );
    expect(screen.getByText('Add Lead')).toBeInTheDocument();
  });

  it('should render without action', () => {
    render(<EmptyState title="Empty" description="No content" />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });
});

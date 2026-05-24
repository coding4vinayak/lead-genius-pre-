import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader, Button } from './index';

describe('PageHeader', () => {
  it('should render title and description', () => {
    render(<PageHeader title="Leads" description="Manage your leads" />);
    expect(screen.getByText('Leads')).toBeInTheDocument();
    expect(screen.getByText('Manage your leads')).toBeInTheDocument();
  });

  it('should render action button when provided', () => {
    render(<PageHeader title="Leads" description="Manage" action={<Button>Add</Button>} />);
    expect(screen.getByText('Add')).toBeInTheDocument();
  });
});

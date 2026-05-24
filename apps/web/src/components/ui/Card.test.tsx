import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './index';

describe('Card', () => {
  it('should render children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('should apply default classes', () => {
    render(<Card>Styled</Card>);
    const card = screen.getByText('Styled');
    expect(card.className).toContain('bg-white');
    expect(card.className).toContain('rounded-xl');
  });

  it('should accept custom className', () => {
    render(<Card className="my-class">Custom</Card>);
    const card = screen.getByText('Custom');
    expect(card.className).toContain('my-class');
  });
});

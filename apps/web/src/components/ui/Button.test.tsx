import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './index';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should apply primary variant by default', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByText('Primary');
    expect(btn.className).toContain('text-white');
  });

  it('should apply secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByText('Secondary');
    expect(btn.className).toContain('bg-gray-100');
  });

  it('should apply danger variant', () => {
    render(<Button variant="danger">Danger</Button>);
    const btn = screen.getByText('Danger');
    expect(btn.className).toContain('bg-red-600');
  });

  it('should apply size classes', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByText('Large');
    expect(btn.className).toContain('px-6');
  });

  it('should be disabled', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByText('Disabled');
    expect(btn).toBeDisabled();
  });

  it('should accept custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const btn = screen.getByText('Custom');
    expect(btn.className).toContain('custom-class');
  });
});

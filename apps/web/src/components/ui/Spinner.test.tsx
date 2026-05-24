import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Spinner } from './index';

describe('Spinner', () => {
  it('should render', () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

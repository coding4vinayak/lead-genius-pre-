import type { ReactNode } from 'react';
import { Button } from './index';

interface LoadingButtonProps {
  loading?: boolean;
  children?: ReactNode;
  variant?: string;
  size?: string;
  className?: string;
  [key: string]: unknown;
}

export function LoadingButton({ loading = false, children, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={loading} {...props}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </Button>
  );
}

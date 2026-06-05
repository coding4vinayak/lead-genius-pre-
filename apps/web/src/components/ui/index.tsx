import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';

type ClassName = string | undefined;

export function Card({ children, className = '', hover = false, ...props }: { children: ReactNode; className?: string; hover?: boolean; [key: string]: any }) {
  return (
    <div
      className={`bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm ${hover ? 'hover:shadow-md hover:border-[var(--color-primary-light)] transition-all duration-200' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ children, variant = 'primary', size = 'md', loading, disabled, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]',
    secondary: 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-border-light)]',
    danger: 'bg-[var(--color-error)] text-white hover:opacity-90',
    ghost: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]',
  };
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className = '', ...props }, ref) => (
  <div className="space-y-1.5">
    {label && <label className="block text-sm font-medium text-[var(--color-text-secondary)]">{label}</label>}
    <input
      ref={ref}
      className={`w-full px-3 py-2 bg-[var(--color-surface)] border rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-colors ${error ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'} ${className}`}
      {...props}
    />
    {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
  </div>
));
Input.displayName = 'Input';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: ({ value: string; label: string } | string)[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, options, error, className = '', ...props }, ref) => (
  <div className="space-y-1.5">
    {label && <label className="block text-sm font-medium text-[var(--color-text-secondary)]">{label}</label>}
    <select
      ref={ref}
      className={`w-full px-3 py-2 bg-[var(--color-surface)] border rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-colors ${error ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'} ${className}`}
      {...props}
    >
      {options.map((opt) => {
        const value = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        return <option key={value} value={value}>{label}</option>;
      })}
    </select>
    {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
  </div>
));
Select.displayName = 'Select';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ children, variant = 'default', className = '' }: { children: ReactNode; variant?: BadgeVariant | string; className?: string }) {
  const variants: Record<string, string> = {
    default: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    danger: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    info: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
}

export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!isOpen) return null;
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-[var(--color-surface)] rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0.3 }}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--color-surface-secondary)] rounded-lg text-[var(--color-text-secondary)] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex items-center justify-center py-12">
      <div className={`${sizes[size]} border-2 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin`} />
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="w-16 h-16 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4 max-w-sm">{description}</p>
      {action}
    </motion.div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <motion.div
      className="flex items-center gap-3 p-4 bg-[var(--color-error-bg)] border border-[var(--color-error)]/30 rounded-lg"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span className="text-[var(--color-error)] font-medium shrink-0">Error:</span>
      <span className="text-sm text-[var(--color-text)] flex-1">{message}</span>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </motion.div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">{title}</h1>
        {description && <p className="text-sm text-[var(--color-text-secondary)] mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
}

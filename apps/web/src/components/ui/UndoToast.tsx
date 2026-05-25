import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface UndoToastProps {
  toastId: string;
  message: string;
  duration?: number;
  onUndo: () => void;
  onConfirm: () => void;
}

export function UndoToast({ toastId, message, duration = 5000, onUndo, onConfirm }: UndoToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = 50;
    const step = (interval / duration) * 100;
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) {
          clearInterval(timer);
          onConfirm();
          toast.dismiss(toastId);
          return 0;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration, onConfirm, toastId]);

  return (
    <div className="flex flex-col gap-2 min-w-[280px]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-text)]">{message}</span>
        <button
          onClick={() => {
            onUndo();
            toast.dismiss(toastId);
          }}
          className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] whitespace-nowrap"
        >
          Undo
        </button>
      </div>
      <div className="w-full h-1 bg-[var(--color-surface-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-50 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function showUndoToast(message: string, onUndo: () => void, onConfirm: () => void, duration = 5000) {
  const id = toast.custom(
    (t) => <UndoToast toastId={t.id} message={message} duration={duration} onUndo={onUndo} onConfirm={onConfirm} />,
    { duration: duration + 500 },
  );
  return id;
}

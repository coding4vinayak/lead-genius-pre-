import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

export function CountUp({ value, duration = 1000, prefix = '', suffix = '' }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    startTime.current = null;

    const animate = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out (decelerate)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * value);

      setDisplay(current);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      }
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [value, duration]);

  return (
    <span>
      {prefix}{display}{suffix}
    </span>
  );
}

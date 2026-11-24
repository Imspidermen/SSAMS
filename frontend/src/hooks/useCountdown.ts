import { useEffect, useState } from 'react';

/**
 * Ticks once per second towards a target instant. Used for the live session
 * timer and the verification-attempt expiry countdown.
 */
export function useCountdown(target: string | Date | null | undefined, active = true): number {
  const [remainingMs, setRemainingMs] = useState<number>(() => compute(target));

  useEffect(() => {
    setRemainingMs(compute(target));
    if (!active || target === null || target === undefined) return;

    const timer = setInterval(() => setRemainingMs(compute(target)), 1000);
    return () => clearInterval(timer);
  }, [target, active]);

  return remainingMs;
}

function compute(target: string | Date | null | undefined): number {
  if (target === null || target === undefined) return 0;
  const time = target instanceof Date ? target.getTime() : new Date(target).getTime();
  if (Number.isNaN(time)) return 0;
  return time - Date.now();
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

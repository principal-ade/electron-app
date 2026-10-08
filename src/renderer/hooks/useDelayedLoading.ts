import { useEffect, useState } from 'react';

/**
 * Avoid flashing loading UI for fast requests, such as when switching panels.
 * The loading indicator still appears if the operation exceeds the delay.
 */
export function useDelayedLoading(
  isLoading: boolean,
  delayMs = 250,
): boolean {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(
      () => setShowLoading(true),
      delayMs,
    );
    return () => window.clearTimeout(timeoutId);
  }, [isLoading, delayMs]);

  return isLoading && showLoading;
}

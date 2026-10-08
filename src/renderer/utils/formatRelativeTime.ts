/**
 * Compact relative-time formatter — "just now", "5m ago", "3h ago", "2d ago",
 * "4mo ago", "1y ago". Returns '' for an unparseable timestamp.
 *
 * Shared by surfaces that show timestamps.
 */
export const formatRelativeTime = (iso: string): string => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const deltaSec = Math.max(0, (Date.now() - t) / 1000);
  if (deltaSec < 60) return 'just now';
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
};

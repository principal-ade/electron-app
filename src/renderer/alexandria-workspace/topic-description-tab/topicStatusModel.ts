/**
 * Shared model for a topic's workflow status — the "aliveness" axis. Kept in
 * its own module so both the editor ({@link TopicStatusControl}) and the
 * clickable graph ({@link TopicStatusGraph}) draw from one source of truth
 * without importing each other.
 */

import { useTheme } from '@principal-ade/industry-theme';
import type { TopicStatus } from '@principal-ai/alexandria-core-library';

export type TopicStatusState = TopicStatus['state'];
type ThemeShape = ReturnType<typeof useTheme>['theme'];

// Ordered by a feature's "aliveness", from nascent idea to retired.
export const STATES: ReadonlyArray<{
  value: TopicStatusState;
  label: string;
}> = [
  { value: 'new-thought', label: 'New Thought' },
  { value: 'working', label: 'Working' },
  { value: 'paused', label: 'Paused' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done-for-now', label: 'Done for now' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'abandoned', label: 'Abandoned' },
];

/** Known state values; used to coerce legacy/unknown reads to the default. */
const KNOWN_STATES = new Set<string>(STATES.map((s) => s.value));

/**
 * Coerce any stored value to a known state. Absent or unrecognized values
 * (including the legacy `active` / `needs-attention` / `done`) read as
 * `new-thought`, the nascent default — so renaming the union needed no data
 * migration.
 */
export function normalizeState(raw: string | undefined): TopicStatusState {
  return raw && KNOWN_STATES.has(raw) ? (raw as TopicStatusState) : 'new-thought';
}

/** State color — keyed off the structured axis, matching the home-card pill.
 *  An aliveness gradient: bright while in motion, fading toward retired. */
export function stateColor(state: TopicStatusState, theme: ThemeShape): string {
  switch (state) {
    case 'working':
      return theme.colors.success;
    case 'paused':
      return theme.colors.warning;
    case 'waiting':
      return theme.colors.info;
    case 'done-for-now':
      return theme.colors.textSecondary;
    case 'deprecated':
      return theme.colors.error;
    case 'abandoned':
      return theme.colors.textTertiary;
    case 'new-thought':
    default:
      return theme.colors.accent;
  }
}

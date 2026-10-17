import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileCityLogo } from '@principal-ai/logo-component';

/**
 * TerminalEmptyState
 *
 * The empty state for the principal window's tabbed terminal (`renderEmptyState`
 * on `TabbedTerminalPanel`). When no terminal tabs are open it shows a rotating
 * set of tips — mostly keyboard shortcuts — that fades one out and the next one
 * in on a timer.
 *
 * Authored in Storybook first so the rotation timing and visual treatment can
 * be dialed in before it is wired into `WorkspaceShell`.
 */

/** A single rotating tip: one or more keycaps and a short description. */
export interface TerminalEmptyStateTip {
  /**
   * Keycap labels for the shortcut, rendered as individual `<kbd>` chips.
   * Pass a single element for a non-shortcut tip (e.g. a plain label), or omit
   * to show the description on its own.
   */
  keys?: string[];
  /** The tip text shown beneath the keycaps. */
  label: string;
}

export interface TerminalEmptyStateProps {
  /** Tips to rotate through. Defaults to the workspace shortcut tips. */
  tips?: TerminalEmptyStateTip[];
  /** How long each tip stays fully visible, in ms. Default 4500. */
  intervalMs?: number;
  /** Cross-fade duration, in ms. Default 450. */
  fadeMs?: number;
  /** Freeze the rotation on the current tip (e.g. while the panel is hidden). */
  paused?: boolean;
  /** Show the progress dots that track the rotation. Default true. */
  showProgressDots?: boolean;
  /** Optional large heading above the call to action. Hidden by default. */
  heading?: string;
  /** Optional supporting line beneath the heading. Hidden by default. */
  subtitle?: string;
}

/** Shortcut tips for the principal workspace terminal. */
export const DEFAULT_TERMINAL_EMPTY_STATE_TIPS: TerminalEmptyStateTip[] = [
  { keys: ['⌘', 'T'], label: 'Open a new terminal tab' },
  { keys: ['⌘', 'W'], label: 'Close the current terminal' },
  { keys: ['⌘', '1–9'], label: 'Jump to a terminal by number' },
  { keys: ['⌘', '⇧', 'F'], label: 'Search files in this repository' },
  { keys: ['⌘', '⇧', 'O'], label: 'Open the project for this terminal' },
  { keys: ['⌘', '⇧', 'E'], label: "Open the explorer for this terminal's project" },
];

/** True when the user asks the OS to minimise non-essential motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

/**
 * How long a tip stays fully hidden between fading out and the next fading in,
 * in ms. A beat long enough that the swap reads as a deliberate pause rather
 * than the previous tip snapping back.
 */
const TIP_DWELL_MS = 300;

/** Which keys are held right now, fed to the keycaps so they light up live. */
interface PressedKeys {
  meta: boolean;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  /** Lowercased `KeyboardEvent.key` values for the non-modifier keys held. */
  keys: Set<string>;
}

const NO_KEYS_PRESSED: PressedKeys = {
  meta: false,
  shift: false,
  ctrl: false,
  alt: false,
  keys: new Set(),
};

/**
 * Tracks the physical keyboard so the tip's keycaps can light up as the user
 * actually presses the shortcut. Listens in the capture phase because the shell
 * consumes some chords (⌘⇧O/F/E) with `stopPropagation`, which would otherwise
 * keep them from reaching a bubble-phase listener. Cleared on window blur so a
 * held modifier doesn't stick when the window loses focus.
 */
function usePressedKeys(): PressedKeys {
  const [pressed, setPressed] = useState<PressedKeys>(NO_KEYS_PRESSED);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onKeyDown = (e: KeyboardEvent) => {
      setPressed((prev) => {
        const keys = new Set(prev.keys);
        keys.add(e.key.toLowerCase());
        return {
          meta: e.metaKey,
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          keys,
        };
      });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      setPressed((prev) => {
        const keys = new Set(prev.keys);
        keys.delete(e.key.toLowerCase());
        return {
          meta: e.metaKey,
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          keys,
        };
      });
    };

    const onBlur = () => setPressed(NO_KEYS_PRESSED);

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return pressed;
}

/** Whether a keycap label (e.g. `⌘`, `⇧`, `E`, `1–9`) is currently pressed. */
function isKeycapPressed(label: string, pressed: PressedKeys): boolean {
  switch (label) {
    case '⌘':
      return pressed.meta;
    case '⇧':
      return pressed.shift;
    case '⌃':
      return pressed.ctrl;
    case '⌥':
      return pressed.alt;
    default:
      break;
  }
  if (label === '1–9') {
    for (const key of pressed.keys) {
      if (key >= '1' && key <= '9') return true;
    }
    return false;
  }
  return pressed.keys.has(label.toLowerCase());
}

/**
 * Drives the tip rotation: hold the current tip visible for `intervalMs`, fade
 * it out over `fadeMs`, hold for {@link TIP_DWELL_MS}, advance, then fade the
 * next one in. Returns the index to show and whether it should currently be
 * opaque.
 */
function useRotatingTip(options: {
  count: number;
  intervalMs: number;
  fadeMs: number;
  paused: boolean;
  animate: boolean;
}): { index: number; visible: boolean } {
  const { count, intervalMs, fadeMs, paused, animate } = options;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const rotating = animate && !paused && count > 1;

  // Fade the current tip in, then schedule its fade-out.
  useEffect(() => {
    // Always show the current tip — including when rotation can't run (single
    // tip, paused, or reduced motion).
    setVisible(true);
    if (!rotating) return;
    const hideTimer = setTimeout(() => setVisible(false), intervalMs);
    return () => clearTimeout(hideTimer);
  }, [index, rotating, intervalMs]);

  // Once faded out, hold at transparent, advance to the next tip, and fade in.
  useEffect(() => {
    if (!rotating || visible) return;
    const advanceTimer = setTimeout(
      () => setIndex((i) => (i + 1) % count),
      fadeMs + TIP_DWELL_MS,
    );
    return () => clearTimeout(advanceTimer);
  }, [visible, rotating, fadeMs, count]);

  // Keep the index valid if the tip list shrinks.
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [index, count]);

  return { index: Math.min(index, Math.max(count - 1, 0)), visible };
}

const KeyCap: React.FC<{
  label: string;
  active?: boolean;
  theme: ReturnType<typeof useTheme>['theme'];
}> = ({ label, active = false, theme }) => (
  <kbd
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '30px',
      height: '30px',
      padding: '0 9px',
      borderRadius: theme.radii[1] ?? 4,
      border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
      backgroundColor: active
        ? theme.colors.primary
        : theme.colors.backgroundSecondary,
      color: active ? theme.colors.textOnPrimary : theme.colors.text,
      fontFamily: theme.fonts.monospace,
      fontSize: theme.fontSizes[2],
      lineHeight: 1,
      boxShadow: active
        ? `0 0 0 3px ${theme.colors.primary}33`
        : '0 1px 0 rgba(0, 0, 0, 0.35)',
      transition:
        'background-color 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease',
    }}
  >
    {label}
  </kbd>
);

const ProgressDots: React.FC<{
  count: number;
  active: number;
  theme: ReturnType<typeof useTheme>['theme'];
}> = ({ count, active, theme }) => (
  <div
    aria-hidden="true"
    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <span
        // Decorative, fixed-length row — position is the identity.
        // eslint-disable-next-line react/no-array-index-key
        key={i}
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '999px',
          backgroundColor:
            i === active ? theme.colors.primary : theme.colors.textMuted,
          opacity: i === active ? 1 : 0.4,
          transition: 'background-color 300ms ease, opacity 300ms ease',
        }}
      />
    ))}
  </div>
);

export const TerminalEmptyState: React.FC<TerminalEmptyStateProps> = ({
  tips = DEFAULT_TERMINAL_EMPTY_STATE_TIPS,
  intervalMs = 4500,
  fadeMs = 450,
  paused = false,
  showProgressDots = true,
  heading,
  subtitle,
}) => {
  const { theme } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const animate = !prefersReducedMotion;
  const pressedKeys = usePressedKeys();

  const tipList = useMemo(() => tips.filter((t) => t.label), [tips]);

  const { index, visible } = useRotatingTip({
    count: tipList.length,
    intervalMs,
    fadeMs,
    paused,
    animate,
  });

  const current = tipList[index];

  return (
    <div
      role="region"
      aria-label="Terminal"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        gap: '18px',
        padding: '32px',
        boxSizing: 'border-box',
        textAlign: 'center',
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
      }}
    >
      <FileCityLogo
        mark="P"
        width={112}
        height={112}
        primary={theme.colors.primary}
        color={theme.colors.text}
        background="transparent"
      />

      {(heading || subtitle) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {heading && (
            <h3
              style={{
                margin: 0,
                fontFamily: theme.fonts.heading,
                fontSize: theme.fontSizes[3],
                fontWeight: theme.fontWeights.medium,
                color: theme.colors.text,
              }}
            >
              {heading}
            </h3>
          )}
          {subtitle && (
            <p
              style={{
                margin: 0,
                maxWidth: '340px',
                fontSize: theme.fontSizes[2],
                lineHeight: theme.lineHeights.body,
                color: theme.colors.textSecondary,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {current && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              // Reserve space for the tallest tip so swapping doesn't nudge the
              // layout above it.
              minHeight: '72px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                opacity: visible ? 1 : 0,
                transition: animate ? `opacity ${fadeMs}ms ease-in-out` : 'none',
              }}
            >
              {current.keys && current.keys.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {current.keys.map((key) => (
                    <KeyCap
                      key={key}
                      label={key}
                      active={isKeycapPressed(key, pressedKeys)}
                      theme={theme}
                    />
                  ))}
                </div>
              )}
              <span
                style={{
                  fontSize: theme.fontSizes[3],
                  color: theme.colors.textSecondary,
                }}
              >
                {current.label}
              </span>
            </div>
          </div>

          {showProgressDots && tipList.length > 1 && (
            <ProgressDots
              count={tipList.length}
              active={index}
              theme={theme}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default TerminalEmptyState;

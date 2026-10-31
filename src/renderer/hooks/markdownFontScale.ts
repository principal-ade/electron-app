/**
 * Per-tab markdown font scaling with a shared, persisted default.
 *
 * Each markdown surface (topic description, markdown document panel) owns its
 * own scale so zooming one tab doesn't disturb another. New surfaces start at
 * the stored default; a surface whose scale drifts from the default can offer
 * to make its value the new default.
 *
 * `useFontScaleShortcuts` wires Cmd/Ctrl `+` / `-` / `0` to a surface. Every
 * mounted surface listens on `window`, so the hook has to decide which one a
 * keypress belongs to: inactive tabs stay mounted but hidden, and a workspace
 * split can show several surfaces at once.
 */

import React, { useEffect, useSyncExternalStore } from 'react';

export const FONT_SCALE_MIN = 0.5;
export const FONT_SCALE_MAX = 3;
export const FONT_SCALE_STEP = 0.1;
export const FONT_SCALE_DEFAULT = 1;

const STORAGE_KEY = 'markdown-font-scale:default';

/** Clamp to the supported range and drop float noise from repeated steps. */
export const clampFontScale = (scale: number): number => {
  if (!Number.isFinite(scale)) return FONT_SCALE_DEFAULT;
  const bounded = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, scale));
  return Math.round(bounded * 100) / 100;
};

export const stepFontScale = (scale: number, direction: 1 | -1): number =>
  clampFontScale(scale + direction * FONT_SCALE_STEP);

const readStoredDefault = (): number => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return FONT_SCALE_DEFAULT;
    return clampFontScale(Number(raw));
  } catch {
    return FONT_SCALE_DEFAULT;
  }
};

let cachedDefault: number | null = null;
const listeners = new Set<() => void>();

export const getDefaultFontScale = (): number => {
  if (cachedDefault === null) cachedDefault = readStoredDefault();
  return cachedDefault;
};

export const setDefaultFontScale = (scale: number): void => {
  const next = clampFontScale(scale);
  if (next === cachedDefault) return;
  cachedDefault = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Storage can be unavailable (private mode, quota); the in-memory
    // default still applies for this session.
  }
  listeners.forEach((listener) => listener());
};

const subscribeDefault = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The shared default, re-rendering when any surface changes it. */
export const useDefaultFontScale = (): number =>
  useSyncExternalStore(subscribeDefault, getDefaultFontScale, getDefaultFontScale);

interface FontScaleShortcutHandlers {
  increase: () => void;
  decrease: () => void;
  reset: () => void;
}

interface RegisteredSurface {
  element: HTMLElement;
  handlers: FontScaleShortcutHandlers;
}

const surfaces = new Set<RegisteredSurface>();
// The surface the pointer most recently entered. Breaks ties when a split
// shows several surfaces and none of them holds focus.
let lastHoveredSurface: RegisteredSurface | null = null;

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
};

const isVisible = (element: HTMLElement): boolean =>
  element.isConnected && element.getClientRects().length > 0;

const shortcutAction = (
  e: KeyboardEvent,
): keyof FontScaleShortcutHandlers | null => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null;
  switch (e.key) {
    case '=':
    case '+':
      return 'increase';
    case '-':
    case '_':
      return 'decrease';
    case '0':
      return 'reset';
    default:
      return null;
  }
};

/** Pick the surface a global shortcut should apply to, if any. */
export const resolveShortcutSurface = (
  candidates: Iterable<RegisteredSurface>,
  activeElement: Element | null,
  hovered: RegisteredSurface | null,
): RegisteredSurface | null => {
  const visible = Array.from(candidates).filter((s) => isVisible(s.element));
  if (visible.length === 0) return null;
  if (activeElement) {
    const focused = visible.find((s) => s.element.contains(activeElement));
    if (focused) return focused;
  }
  if (hovered && visible.includes(hovered)) return hovered;
  return visible.length === 1 ? visible[0] : null;
};

const onWindowKeyDown = (e: KeyboardEvent) => {
  const action = shortcutAction(e);
  if (!action || e.defaultPrevented) return;
  // Terminals and text fields keep their own meaning for these keys.
  if (isEditableTarget(e.target)) return;
  const surface = resolveShortcutSurface(
    surfaces,
    document.activeElement,
    lastHoveredSurface,
  );
  if (!surface) return;
  e.preventDefault();
  surface.handlers[action]();
};

interface Registration {
  surface: RegisteredSurface;
  dispose: () => void;
}

const registerSurface = (
  element: HTMLElement,
  handlersRef: React.MutableRefObject<FontScaleShortcutHandlers>,
): Registration => {
  const surface: RegisteredSurface = {
    element,
    handlers: {
      increase: () => handlersRef.current.increase(),
      decrease: () => handlersRef.current.decrease(),
      reset: () => handlersRef.current.reset(),
    },
  };
  const onPointerEnter = () => {
    lastHoveredSurface = surface;
  };
  element.addEventListener('pointerenter', onPointerEnter);
  if (surfaces.size === 0) {
    window.addEventListener('keydown', onWindowKeyDown, true);
  }
  surfaces.add(surface);
  return {
    surface,
    dispose: () => {
      surfaces.delete(surface);
      element.removeEventListener('pointerenter', onPointerEnter);
      if (lastHoveredSurface === surface) lastHoveredSurface = null;
      if (surfaces.size === 0) {
        window.removeEventListener('keydown', onWindowKeyDown, true);
      }
    },
  };
};

/**
 * Register `containerRef` as a font-scale surface for the lifetime of the
 * component. The handlers are read through a ref so callers can pass fresh
 * closures on every render. The element is re-checked after every render
 * because hosts with loading/error branches attach the ref only once their
 * main view mounts.
 */
export const useFontScaleShortcuts = (
  containerRef: React.RefObject<HTMLElement | null>,
  handlers: FontScaleShortcutHandlers,
): void => {
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;
  const registrationRef = React.useRef<Registration | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (registrationRef.current?.surface.element === element) return;
    registrationRef.current?.dispose();
    registrationRef.current = element
      ? registerSurface(element, handlersRef)
      : null;
  });

  useEffect(
    () => () => {
      registrationRef.current?.dispose();
      registrationRef.current = null;
    },
    [],
  );
};

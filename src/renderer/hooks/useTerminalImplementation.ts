import { useEffect, useState } from 'react';

import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export type TerminalImplementation = 'xterm' | 'ghostty';

/**
 * Default terminal renderer. We default to ghostty; users can switch to xterm
 * via the `terminalImplementation` preference.
 */
export const DEFAULT_TERMINAL_IMPLEMENTATION: TerminalImplementation = 'ghostty';

function normalize(value: unknown): TerminalImplementation {
  return value === 'xterm' ? 'xterm' : DEFAULT_TERMINAL_IMPLEMENTATION;
}

/**
 * Resolve the user's terminal renderer choice from preferences, staying in sync
 * with updates. Returns `'ghostty'` (the default) unless the user picked xterm.
 * Feed the result straight into a panel's `renderer` prop.
 */
export function useTerminalImplementation(): TerminalImplementation {
  const [implementation, setImplementation] = useState<TerminalImplementation>(
    DEFAULT_TERMINAL_IMPLEMENTATION,
  );

  useEffect(() => {
    let mounted = true;

    UserPreferencesService.getPreferences()
      .then((prefs) => {
        if (mounted) setImplementation(normalize(prefs.terminalImplementation));
      })
      .catch(() => {
        /* keep the default */
      });

    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      setImplementation(normalize(prefs.terminalImplementation));
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  return implementation;
}

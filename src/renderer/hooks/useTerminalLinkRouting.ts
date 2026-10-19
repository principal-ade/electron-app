import { useCallback, useEffect, useRef } from 'react';
import { parseLocalhostBrowserUrl } from '../../shared/utils/localhostBrowserUrl';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { ShellService } from '../main-process-api/ShellService';
import { BrowserService } from '../services/BrowserService';

/** Shared by event-bus terminals and direct floating-terminal callbacks. */
export function useTerminalLinkRouting(): (url: string) => void {
  const enabled = useRef(false);

  useEffect(() => {
    let mounted = true;
    let updated = false;
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      updated = true;
      enabled.current = prefs.openLocalhostTerminalLinksInApp === true;
    });
    void UserPreferencesService.getPreferences()
      .then((prefs) => {
        if (mounted && !updated) {
          enabled.current = prefs.openLocalhostTerminalLinksInApp === true;
        }
      })
      .catch(() => {
        /* Keep external opening when preferences are unavailable. */
      });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return useCallback((url: string) => {
    if (!url) return;
    const open = async () => {
      if (enabled.current) {
        try {
          parseLocalhostBrowserUrl(url);
          if (await BrowserService.openLocalhostUrl(url)) return;
        } catch {
          // Unsupported URLs and unavailable app tabs retain external opening.
        }
      }
      await ShellService.openExternal(url);
    };
    void open().catch(() => {
      console.error('[TerminalLinks] Could not open the clicked link.');
    });
  }, []);
}

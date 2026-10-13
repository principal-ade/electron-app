import { useState, useEffect } from 'react';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export interface HomePanelPreferences {
  recentlyVisited: boolean;
}

const DEFAULT: HomePanelPreferences = {
  recentlyVisited: false,
};

export function useHomePanelPreferences(): HomePanelPreferences {
  const [prefs, setPrefs] = useState<HomePanelPreferences>(DEFAULT);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const all = await UserPreferencesService.getPreferences();
      if (cancelled) return;
      const hp = all.homePanel;
      setPrefs({
        recentlyVisited: hp?.recentlyVisited ?? false,
      });
    };

    void load();

    const unsubscribe = UserPreferencesService.onPreferencesUpdated((all) => {
      const hp = all.homePanel;
      setPrefs({
        recentlyVisited: hp?.recentlyVisited ?? false,
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return prefs;
}

/**
 * OnboardingView
 *
 * Main view component for the onboarding experience.
 * Manages onboarding state and persistence via UserPreferencesService.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { OnboardingPanelFramework } from './OnboardingPanelFramework';
import {
  type OnboardingState,
  DEFAULT_ONBOARDING_STATE,
} from './types/onboarding.types';

export interface OnboardingViewProps {
  /** Optional callback when user dismisses/completes onboarding */
  onComplete?: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const { theme } = useTheme();
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(
    DEFAULT_ONBOARDING_STATE,
  );
  const [loading, setLoading] = useState(true);
  // Ref to ignore external preference updates while we're saving our own changes
  const isSavingRef = React.useRef(false);

  // Load onboarding state from preferences
  useEffect(() => {
    const loadState = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();
        const savedState = prefs.onboarding;

        if (savedState) {
          setOnboardingState(savedState);
        } else {
          // First time - mark as started
          const initialState: OnboardingState = {
            ...DEFAULT_ONBOARDING_STATE,
            started: true,
            startedAt: Date.now(),
          };
          setOnboardingState(initialState);
          await UserPreferencesService.updatePreferences({
            onboarding: initialState,
          });
        }
      } catch (error) {
        console.error('[OnboardingView] Failed to load onboarding state:', error);
      } finally {
        setLoading(false);
      }
    };

    loadState();

    // Subscribe to preference updates (but ignore while we're saving our own changes)
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      // Don't overwrite local state while we're in the middle of saving
      if (prefs.onboarding && !isSavingRef.current) {
        setOnboardingState(prefs.onboarding);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Mark a card as completed
  const handleMarkCompleted = useCallback(async (cardId: string) => {
    setOnboardingState((prev) => {
      const newState: OnboardingState = {
        ...prev,
        cardStates: {
          ...prev.cardStates,
          [cardId]: {
            completed: true,
            completedAt: Date.now(),
          },
        },
      };

      // Persist asynchronously
      UserPreferencesService.updatePreferences({
        onboarding: newState,
      }).catch((error) => {
        console.error('[OnboardingView] Failed to save card completion:', error);
      });

      return newState;
    });
  }, []);

  // Dismiss onboarding
  const handleDismiss = useCallback(async () => {
    const newState: OnboardingState = {
      ...onboardingState,
      dismissed: true,
      dismissedAt: Date.now(),
    };

    setOnboardingState(newState);

    try {
      await UserPreferencesService.updatePreferences({
        onboarding: newState,
      });
    } catch (error) {
      console.error('[OnboardingView] Failed to save dismiss state:', error);
    }

    onComplete?.();
  }, [onboardingState, onComplete]);

  // Reset onboarding
  const handleReset = useCallback(async () => {
    const newState: OnboardingState = {
      started: true,
      startedAt: Date.now(),
      cardStates: {},
      dismissed: false,
    };

    // Prevent external updates from overwriting our reset
    isSavingRef.current = true;
    setOnboardingState(newState);

    try {
      await UserPreferencesService.updatePreferences({
        onboarding: newState,
      });
    } catch (error) {
      console.error('[OnboardingView] Failed to reset onboarding state:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      <OnboardingPanelFramework
        onboardingState={onboardingState}
        onMarkCompleted={handleMarkCompleted}
        onDismiss={handleDismiss}
        onReset={handleReset}
      />
    </div>
  );
};

export default OnboardingView;

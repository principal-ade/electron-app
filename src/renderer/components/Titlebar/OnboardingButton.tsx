import React, { useEffect, useState, useCallback } from 'react';
import { GraduationCap } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { ONBOARDING_CARDS } from '../../principal-window/views/OnboardingView/data/onboardingCards';
import type { OnboardingState } from '../../principal-window/views/OnboardingView/types/onboarding.types';

interface OnboardingButtonProps {
  onClick: () => void;
}

export const OnboardingButton: React.FC<OnboardingButtonProps> = ({ onClick }) => {
  const { theme } = useTheme();
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    const loadState = async () => {
      const prefs = await UserPreferencesService.getPreferences();
      setOnboardingState(prefs.onboarding ?? null);
    };

    loadState();

    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      setOnboardingState(prefs.onboarding ?? null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  // Calculate completion status
  const completedCount = onboardingState
    ? Object.values(onboardingState.cardStates).filter((s) => s.completed).length
    : 0;
  const totalCount = ONBOARDING_CARDS.length;
  const isComplete = onboardingState?.dismissed || completedCount === totalCount;
  const showBadge = !isComplete && totalCount > 0;

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '6px',
        backgroundColor: isComplete
          ? theme.colors.backgroundSecondary
          : theme.colors.primary,
        color: isComplete ? theme.colors.textSecondary : '#ffffff',
        border: `1px solid ${isComplete ? theme.colors.border : theme.colors.primary}`,
        cursor: 'pointer',
        fontSize: theme.fontSizes[1],
        fontWeight: 500,
        fontFamily: theme.fonts.body,
        transition: 'all 0.2s',
        WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (isComplete) {
          e.currentTarget.style.backgroundColor = theme.colors.background;
          e.currentTarget.style.borderColor = theme.colors.textSecondary;
        } else {
          e.currentTarget.style.opacity = '0.9';
        }
      }}
      onMouseLeave={(e) => {
        if (isComplete) {
          e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
          e.currentTarget.style.borderColor = theme.colors.border;
        } else {
          e.currentTarget.style.opacity = '1';
        }
      }}
      title={isComplete ? 'Tutorials complete' : `Tutorials: ${completedCount}/${totalCount} completed`}
    >
      <GraduationCap size={14} />
      <span>Tutorials</span>
      {showBadge && (
        <span
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            padding: '2px 6px',
            borderRadius: '10px',
            fontSize: theme.fontSizes[0],
            fontWeight: 600,
          }}
        >
          {completedCount}/{totalCount}
        </span>
      )}
    </button>
  );
};

export default OnboardingButton;

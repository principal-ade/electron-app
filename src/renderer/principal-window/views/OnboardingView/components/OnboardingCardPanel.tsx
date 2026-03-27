import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { OnboardingCard } from './OnboardingCard';
import { ONBOARDING_CARDS } from '../data/onboardingCards';
import type { OnboardingState } from '../types/onboarding.types';

interface OnboardingCardPanelProps {
  onboardingState: OnboardingState;
  onMarkCompleted: (cardId: string) => void;
}

export const OnboardingCardPanel: React.FC<OnboardingCardPanelProps> = ({
  onboardingState,
  onMarkCompleted,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <h2
          style={{
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            color: theme.colors.text,
            margin: 0,
          }}
        >
          Get Started
        </h2>
        <p
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            margin: '4px 0 0 0',
          }}
        >
          Drag cards into the terminal to learn
        </p>
      </div>

      {/* Cards list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {ONBOARDING_CARDS.map((card) => (
          <OnboardingCard
            key={card.id}
            card={card}
            isCompleted={onboardingState.cardStates[card.id]?.completed ?? false}
            onMarkCompleted={onMarkCompleted}
          />
        ))}

        {ONBOARDING_CARDS.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0 }}>No onboarding cards available.</p>
          </div>
        )}
      </div>
    </div>
  );
};

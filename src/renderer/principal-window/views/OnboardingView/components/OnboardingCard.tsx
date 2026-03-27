import React, { useCallback } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { OnboardingCard as OnboardingCardType } from '../types/onboarding.types';

interface OnboardingCardProps {
  card: OnboardingCardType;
  isCompleted: boolean;
  onMarkCompleted?: (cardId: string) => void;
}

export const OnboardingCard: React.FC<OnboardingCardProps> = ({
  card,
  isCompleted,
  onMarkCompleted,
}) => {
  const { theme } = useTheme();
  const Icon = card.icon;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', card.agentPrompt);
      e.dataTransfer.effectAllowed = 'copy';

      // Mark as completed when dragged
      if (!isCompleted && onMarkCompleted) {
        onMarkCompleted(card.id);
      }
    },
    [card.agentPrompt, card.id, isCompleted, onMarkCompleted],
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: theme.radii?.[2] || 8,
        border: `1px solid ${isCompleted ? theme.colors.primary : theme.colors.border}`,
        padding: 16,
        cursor: 'grab',
        opacity: isCompleted ? 0.7 : 1,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!isCompleted) {
          e.currentTarget.style.borderColor = theme.colors.primary;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isCompleted
          ? theme.colors.primary
          : theme.colors.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header with icon and completion status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: isCompleted
              ? theme.colors.primary + '20'
              : theme.colors.background,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon
            size={20}
            color={isCompleted ? theme.colors.primary : theme.colors.textSecondary}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: theme.fontSizes[2],
              fontWeight: 600,
              color: theme.colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {card.title}
            {isCompleted && (
              <CheckCircle2 size={16} color={theme.colors.primary} />
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {card.description}
      </p>

      {/* Details (if available) */}
      {card.details && (
        <p
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            margin: '8px 0 0 0',
            lineHeight: 1.4,
            fontStyle: 'italic',
          }}
        >
          {card.details}
        </p>
      )}

      {/* Drag hint */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${theme.colors.border}`,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ opacity: 0.8 }}>
          {isCompleted ? 'Completed' : 'Drag to terminal to start'}
        </span>
      </div>
    </div>
  );
};

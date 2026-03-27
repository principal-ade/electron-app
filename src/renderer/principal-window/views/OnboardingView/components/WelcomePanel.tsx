import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, Terminal, Sparkles, MessageSquare, Check, RotateCcw } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';

interface WelcomePanelProps {
  completedCount: number;
  totalCount: number;
  onDismiss: () => void;
  onReset: () => void;
  hasTerminal?: boolean;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isComplete: boolean;
  isCurrent: boolean;
}

export const WelcomePanel: React.FC<WelcomePanelProps> = ({
  completedCount,
  totalCount,
  onDismiss,
  onReset,
  hasTerminal = false,
}) => {
  const { theme } = useTheme();
  const [showResetModal, setShowResetModal] = useState(false);
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  // Define onboarding steps based on current state
  // Step 1: Start a terminal
  // Step 2: Launch an agent (instruction only - we can't detect this)
  // Step 3: Drag a card to ask a question
  const hasCompletedCard = completedCount > 0;

  const steps: OnboardingStep[] = [
    {
      id: 'terminal',
      title: 'Start a terminal',
      description: 'Click the + button in the terminal panel to create a new session',
      icon: <Terminal size={18} />,
      isComplete: hasTerminal,
      isCurrent: !hasTerminal,
    },
    {
      id: 'agent',
      title: 'Launch an agent',
      description: 'Run claude or opencode in the terminal to start an AI agent',
      icon: <Sparkles size={18} />,
      isComplete: hasCompletedCard, // We assume they launched an agent if they completed a card
      isCurrent: hasTerminal && !hasCompletedCard,
    },
    {
      id: 'interact',
      title: 'Ask a question',
      description: 'Drag a card from the right panel into the terminal',
      icon: <MessageSquare size={18} />,
      isComplete: hasCompletedCard,
      isCurrent: false, // This step completes instantly when they drag, never needs to be "current"
    },
  ];

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: theme.colors.primary + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GraduationCap size={24} color={theme.colors.primary} />
        </div>
        <div>
          <h1
            style={{
              fontSize: theme.fontSizes[4],
              fontWeight: 700,
              color: theme.colors.text,
              margin: 0,
            }}
          >
            Welcome to Principal AI
          </h1>
          <p
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              margin: 0,
            }}
          >
            Let&apos;s get you started
          </p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
            }}
          >
            Progress
          </span>
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontWeight: 600,
              color: isComplete ? theme.colors.primary : theme.colors.text,
            }}
          >
            {completedCount} / {totalCount}
          </span>
        </div>
        <div
          style={{
            height: 8,
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: theme.colors.primary,
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflow: 'auto',
        }}
      >
        <h3
          style={{
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            color: theme.colors.textSecondary,
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Getting Started
        </h3>

        {steps.map((step, index) => (
          <div
            key={step.id}
            style={{
              backgroundColor: step.isCurrent
                ? theme.colors.primary + '10'
                : theme.colors.backgroundSecondary,
              borderRadius: 8,
              padding: 12,
              border: `1px solid ${
                step.isCurrent
                  ? theme.colors.primary
                  : step.isComplete
                    ? theme.colors.primary + '40'
                    : theme.colors.border
              }`,
              opacity: step.isComplete && !step.isCurrent ? 0.7 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              {/* Step number or check */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: step.isComplete
                    ? theme.colors.primary
                    : step.isCurrent
                      ? theme.colors.primary + '20'
                      : theme.colors.background,
                  border: `2px solid ${
                    step.isComplete || step.isCurrent
                      ? theme.colors.primary
                      : theme.colors.border
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: step.isComplete
                    ? '#ffffff'
                    : step.isCurrent
                      ? theme.colors.primary
                      : theme.colors.textSecondary,
                }}
              >
                {step.isComplete ? (
                  <Check size={14} strokeWidth={3} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{index + 1}</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      color: step.isCurrent
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                    }}
                  >
                    {step.icon}
                  </span>
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      fontWeight: 600,
                      color: step.isCurrent
                        ? theme.colors.text
                        : step.isComplete
                          ? theme.colors.textSecondary
                          : theme.colors.text,
                    }}
                  >
                    {step.title}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div
        style={{
          marginTop: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          onClick={onDismiss}
          style={{
            padding: '12px 16px',
            backgroundColor: isComplete
              ? theme.colors.primary
              : theme.colors.backgroundSecondary,
            color: isComplete ? '#ffffff' : theme.colors.textSecondary,
            border: `1px solid ${isComplete ? theme.colors.primary : theme.colors.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: theme.fontSizes[1],
            fontWeight: 500,
            fontFamily: theme.fonts.body,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isComplete) {
              e.currentTarget.style.backgroundColor = theme.colors.background;
              e.currentTarget.style.borderColor = theme.colors.textSecondary;
            }
          }}
          onMouseLeave={(e) => {
            if (!isComplete) {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.border;
            }
          }}
        >
          {isComplete ? 'Complete Onboarding' : 'Skip for now'}
        </button>

        <button
          onClick={() => setShowResetModal(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: theme.fontSizes[0],
            fontFamily: theme.fonts.body,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <RotateCcw size={12} />
          Restart onboarding
        </button>
      </div>

      {/* Reset confirmation modal */}
      {showResetModal &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
            onClick={() => setShowResetModal(false)}
          >
            <div
              style={{
                backgroundColor: theme.colors.background,
                borderRadius: 12,
                padding: 24,
                maxWidth: 400,
                width: '90%',
                border: `1px solid ${theme.colors.border}`,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: '0 0 8px 0',
                }}
              >
                Restart Onboarding?
              </h3>
              <p
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  margin: '0 0 24px 0',
                  lineHeight: 1.5,
                }}
              >
                This will reset your progress and start the onboarding from the beginning.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  onClick={() => setShowResetModal(false)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: theme.fontSizes[1],
                    fontWeight: 500,
                    fontFamily: theme.fonts.body,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowResetModal(false);
                    onReset();
                  }}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: theme.colors.primary,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: theme.fontSizes[1],
                    fontWeight: 500,
                    fontFamily: theme.fonts.body,
                  }}
                >
                  Restart
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

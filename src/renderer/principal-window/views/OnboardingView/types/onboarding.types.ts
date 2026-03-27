import type { LucideIcon } from 'lucide-react';

/**
 * Represents a single onboarding concept card
 */
export interface OnboardingCard {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Short description */
  description: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Category for grouping cards */
  category: 'getting-started' | 'features' | 'advanced';
  /** Agent prompt to inject when dropped into terminal */
  agentPrompt: string;
  /** Optional longer explanation shown on hover/expand */
  details?: string;
}

/**
 * Onboarding completion state for a single card
 */
export interface OnboardingCardState {
  completed: boolean;
  completedAt?: number;
}

/**
 * Full onboarding state stored in user preferences
 */
export interface OnboardingState {
  /** Whether onboarding has been started */
  started: boolean;
  /** Timestamp when onboarding was started */
  startedAt?: number;
  /** Per-card completion states keyed by card id */
  cardStates: Record<string, OnboardingCardState>;
  /** Whether user has dismissed/completed onboarding */
  dismissed: boolean;
  /** Timestamp when dismissed */
  dismissedAt?: number;
}

/**
 * Default onboarding state for new users
 */
export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  started: false,
  cardStates: {},
  dismissed: false,
};

import { Sparkles } from 'lucide-react';
import type { OnboardingCard } from '../types/onboarding.types';

/**
 * Onboarding cards defining concepts users can learn about.
 * Each card has an agent prompt that gets injected when dropped into the terminal.
 */
export const ONBOARDING_CARDS: OnboardingCard[] = [
  {
    id: 'welcome-agent',
    title: 'Meet Your Agent',
    description: 'Learn how to interact with the AI agent in the terminal',
    icon: Sparkles,
    category: 'getting-started',
    agentPrompt:
      "Hello! I'm new to Principal AI. Can you introduce yourself and explain what you can help me with? What are some things I should try first?",
    details:
      'Drop this card into the terminal to start a conversation with your AI agent and learn about its capabilities.',
  },
  // Add more onboarding cards here as needed
];

/**
 * Get an onboarding card by its ID
 */
export const getCardById = (id: string): OnboardingCard | undefined =>
  ONBOARDING_CARDS.find((card) => card.id === id);

/**
 * Get all onboarding cards in a specific category
 */
export const getCardsByCategory = (
  category: OnboardingCard['category'],
): OnboardingCard[] => ONBOARDING_CARDS.filter((card) => card.category === category);

/**
 * Get all unique categories from the cards
 */
export const getCategories = (): OnboardingCard['category'][] => {
  const categories = new Set(ONBOARDING_CARDS.map((card) => card.category));
  return Array.from(categories);
};

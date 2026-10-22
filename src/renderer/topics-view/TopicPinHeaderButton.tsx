import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Pin } from 'lucide-react';
import type { HomePinnedTab } from '../../shared/types/userPreferences.types';
import { useHomePins } from '../panels/home-panel/useHomePins';

/**
 * Shared Home-pin action for both local topic-tab headers. The pin is the same
 * `interactiveShell.homePinnedTabs` entry the Home rail uses, keyed by the
 * shell's canonical topic tab id so an open tab and its pin never duplicate.
 */
export const TopicPinHeaderButton: React.FC<{
  topicId: string;
  title?: string;
}> = ({ topicId, title }) => {
  const { theme } = useTheme();
  const { isTabPinned, toggleTabPin } = useHomePins();

  const tabId = `local-topic-${topicId}`;
  const label = title || 'Topic';
  const pinned = isTabPinned(tabId);
  const entry: HomePinnedTab = {
    id: tabId,
    kind: 'topic',
    label,
    topicId,
    ...(title !== undefined ? { title } : {}),
  };

  return (
    <button
      type="button"
      onClick={() => toggleTabPin(entry)}
      title={pinned ? 'Unpin from Home' : 'Pin to Home'}
      aria-label={pinned ? `Unpin ${label} from Home` : `Pin ${label} to Home`}
      aria-pressed={pinned}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        flexShrink: 0,
        padding: 0,
        borderRadius: 6,
        border: `1px solid ${
          pinned ? theme.colors.primary : theme.colors.border
        }`,
        background: theme.colors.backgroundSecondary,
        color: pinned ? theme.colors.primary : theme.colors.text,
        cursor: 'pointer',
        transition: 'color 0.15s ease, border-color 0.15s ease',
      }}
    >
      <Pin size={16} fill={pinned ? 'currentColor' : 'none'} />
    </button>
  );
};

export default TopicPinHeaderButton;

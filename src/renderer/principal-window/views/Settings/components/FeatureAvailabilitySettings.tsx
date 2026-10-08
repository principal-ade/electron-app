import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import type { UserPreferences } from '../../../../../shared/types/userPreferences.types';
import { USER_PREFERENCE_DEFAULTS } from '../../../../../shared/types/userPreferences.types';

type HostedFeature = keyof typeof USER_PREFERENCE_DEFAULTS.featureAvailability;

const FEATURE_GROUPS: Array<{
  key: HostedFeature;
  label: string;
  description: string;
}> = [
  {
    key: 'repositoryInsightsAndCollections',
    label: 'Repository insights & collections',
    description:
      'Cached repository trees, contribution data, profile activity, pinned repositories, starred collections, and commit explanations.',
  },
  {
    key: 'topicSharing',
    label: 'Topic sharing & inbox',
    description:
      'Publishing and opening shared topics, including the topic inbox.',
  },
  {
    key: 'presenceAndCollaboration',
    label: 'Presence & collaboration',
    description:
      'Presence, GitSync collaboration, Orbit signaling, and remote-terminal token exchange.',
  },
  {
    key: 'signIn',
    label: 'Sign-in',
    description:
      'GitHub sign-in through the hosted auth server, plus WorkOS session refresh and token synchronization.',
  },
];

export const FeatureAvailabilitySettings: React.FC = () => {
  const { theme } = useTheme();
  const [availability, setAvailability] = useState(
    USER_PREFERENCE_DEFAULTS.featureAvailability,
  );

  useEffect(() => {
    let mounted = true;
    const applyPreferences = (preferences: UserPreferences) => {
      if (mounted) {
        setAvailability({
          ...USER_PREFERENCE_DEFAULTS.featureAvailability,
          ...preferences.featureAvailability,
        });
      }
    };

    UserPreferencesService.getPreferences().then(applyPreferences);
    const unsubscribe =
      UserPreferencesService.onPreferencesUpdated(applyPreferences);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const updateFeature = async (key: HostedFeature, enabled: boolean) => {
    const next = { ...availability, [key]: enabled };
    setAvailability(next);
    await UserPreferencesService.updatePreferences({
      featureAvailability: next,
    });
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h4
        style={{
          color: theme.colors.text,
          fontSize: 16,
          fontWeight: 600,
          margin: '0 0 8px',
        }}
      >
        Hosted feature availability
      </h4>
      <p
        style={{
          color: theme.colors.textSecondary,
          fontSize: 13,
          lineHeight: 1.5,
          margin: '0 0 20px',
        }}
      >
        Enable only the hosted features whose services are available. These
        switches do not affect local repositories, topics, or terminals.
      </p>
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 12,
          padding: '4px 20px',
        }}
      >
        {FEATURE_GROUPS.map(({ key, label, description }, index) => (
          <div
            key={key}
            style={{
              alignItems: 'center',
              borderBottom:
                index === FEATURE_GROUPS.length - 1
                  ? 'none'
                  : `1px solid ${theme.colors.border}`,
              display: 'flex',
              gap: 16,
              justifyContent: 'space-between',
              padding: '18px 0',
            }}
          >
            <div>
              <div
                style={{
                  color: theme.colors.text,
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 5,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {description}
              </div>
            </div>
            <label
              style={{
                flexShrink: 0,
                height: 24,
                position: 'relative',
                width: 48,
              }}
            >
              <input
                aria-label={`Enable ${label}`}
                checked={availability[key]}
                onChange={(event) => updateFeature(key, event.target.checked)}
                type="checkbox"
                style={{ height: 0, opacity: 0, width: 0 }}
              />
              <span
                style={{
                  backgroundColor: availability[key]
                    ? theme.colors.primary
                    : theme.colors.border,
                  borderRadius: 24,
                  bottom: 0,
                  cursor: 'pointer',
                  left: 0,
                  position: 'absolute',
                  right: 0,
                  top: 0,
                }}
              >
                <span
                  style={{
                    backgroundColor: theme.colors.background,
                    borderRadius: '50%',
                    height: 18,
                    left: availability[key] ? 27 : 3,
                    position: 'absolute',
                    top: 3,
                    transition: 'left 0.2s',
                    width: 18,
                  }}
                />
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

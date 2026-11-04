/**
 * SecretsOverviewTabContent
 *
 * Read-only overview of every secret env name used by build configurations,
 * each expandable to the configurations that use it.
 * Presentational only: no main-process calls, no secret values.
 */

import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface SecretUsageConfig {
  id: string;
  name: string;
  granted: boolean;
}

export interface SecretUsageEntry {
  env: string;
  label?: string;
  configs: SecretUsageConfig[];
}

export interface SecretsOverviewTabContentProps {
  secrets: SecretUsageEntry[];
  /** Navigate to a configuration that uses the secret. */
  onOpenConfig?: (configId: string) => void;
}

export const SecretsOverviewTabContent: React.FC<
  SecretsOverviewTabContentProps
> = ({ secrets, onOpenConfig }) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        background: theme.colors.background,
      }}
    >
      <div
        style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 40px' }}
      >
        <div
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[4],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
          }}
        >
          Secrets
        </div>
        <div
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textMuted,
            marginTop: 4,
          }}
        >
          {secrets.length === 0
            ? 'No secrets declared by any configuration.'
            : `${secrets.length} secret${secrets.length === 1 ? '' : 's'} across configurations. Values are never shown here.`}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 16,
          }}
        >
          {secrets.map((secret) => {
            const open = expanded === secret.env;
            const missing = secret.configs.filter((c) => !c.granted).length;
            const color =
              missing > 0 ? theme.colors.warning : theme.colors.success;
            return (
              <div
                key={secret.env}
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : secret.env)}
                  aria-expanded={open}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {open ? (
                    <ChevronDown size={14} color={theme.colors.textSecondary} />
                  ) : (
                    <ChevronRight
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: theme.fonts.monospace,
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.text,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {secret.env}
                    </div>
                    <div
                      style={{
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textMuted,
                      }}
                    >
                      {[secret.label, `used by ${secret.configs.length}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[0],
                      fontWeight: theme.fontWeights.semibold,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color,
                      border: `1px solid ${color}60`,
                      background: `${color}12`,
                      borderRadius: 999,
                      padding: '2px 10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {missing > 0 ? `${missing} missing` : 'granted'}
                  </span>
                </button>
                {open && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    {secret.configs.map((config) => {
                      const configColor = config.granted
                        ? theme.colors.success
                        : theme.colors.warning;
                      return (
                        <button
                          key={config.id}
                          type="button"
                          onClick={() => onOpenConfig?.(config.id)}
                          disabled={!onOpenConfig}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            padding: '2px',
                            cursor: onOpenConfig ? 'pointer' : 'default',
                            textAlign: 'left',
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontFamily: theme.fonts.body,
                              fontSize: theme.fontSizes[1],
                              color: onOpenConfig
                                ? theme.colors.primary
                                : theme.colors.text,
                            }}
                          >
                            {config.name}
                          </div>
                          <span
                            style={{
                              fontFamily: theme.fonts.body,
                              fontSize: theme.fontSizes[0],
                              fontWeight: theme.fontWeights.semibold,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              color: configColor,
                              border: `1px solid ${configColor}60`,
                              background: `${configColor}12`,
                              borderRadius: 999,
                              padding: '2px 10px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {config.granted ? 'granted' : 'missing'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SecretsOverviewTabContent;

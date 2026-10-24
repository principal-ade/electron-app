import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { RequestGroupItem, RequestPurlGroup } from './requestGroups';

export const RequestGroupList: React.FC<{
  groups: RequestPurlGroup[];
  renderRequest: (request: RequestGroupItem, depth: number) => React.ReactNode;
  variant?: 'section' | 'sidebar';
  showTooltips?: boolean;
}> = ({ groups, renderRequest, variant = 'section', showTooltips = true }) => {
  const { theme } = useTheme();
  if (groups.length === 0) return null;
  const sidebar = variant === 'sidebar';
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };
  const summaryStyle: React.CSSProperties = sidebar
    ? {
        padding: `${spacing.xs * 1.5}px ${spacing.sm * 2}px`,
        minHeight: 30,
        boxSizing: 'border-box',
        borderBottom: `1px solid ${theme.colors.border}`,
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        fontWeight: 600,
        cursor: 'pointer',
        overflowWrap: 'anywhere',
      }
    : {
        padding: '6px 14px',
        color: theme.colors.textSecondary,
        fontSize: 12,
        cursor: 'pointer',
        overflowWrap: 'anywhere',
      };
  return (
    <section aria-label="Requests" style={{ marginBottom: sidebar ? 0 : 8 }}>
      {!sidebar && (
        <h2
          style={{
            margin: 0,
            padding: '8px 14px 4px',
            color: theme.colors.textSecondary,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Requests
        </h2>
      )}
      {groups.map((group) => (
        <details key={JSON.stringify([group.purl ?? null])} open>
          <summary
            style={summaryStyle}
            title={showTooltips ? group.purl : undefined}
          >
            {group.purl ?? 'Ungrouped'}
          </summary>
          {group.identifiers.map((identifier) =>
            group.purl === undefined ? (
              <React.Fragment key="ungrouped">
                {identifier.requests.map((request) =>
                  renderRequest(request, 1),
                )}
              </React.Fragment>
            ) : (
              <details
                key={identifier.identifier}
                open
                style={{ marginLeft: sidebar ? spacing.sm * 2 : 18 }}
              >
                <summary style={summaryStyle}>{identifier.identifier}</summary>
                {identifier.requests.map((request) =>
                  renderRequest(request, 1),
                )}
              </details>
            ),
          )}
        </details>
      ))}
    </section>
  );
};

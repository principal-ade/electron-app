import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Activity,
  Bot,
  Check,
  CircleAlert,
  CircleX,
  Clock3,
  Database,
  GitBranch,
  Info,
  RefreshCw,
  Server,
} from 'lucide-react';
import { PrincipalMark } from '../../../components/PrincipalMark';
import type {
  OpenBotDeploymentComponent,
  OpenBotDeploymentEvent,
  OpenBotDeploymentSnapshot,
  OpenBotHealthState,
} from '../../../../shared/main-process-api-interfaces/OpenBotChatAPI';

export type {
  OpenBotDeploymentComponent,
  OpenBotDeploymentEvent,
  OpenBotDeploymentSnapshot,
  OpenBotHealthState,
} from '../../../../shared/main-process-api-interfaces/OpenBotChatAPI';

interface OpenBotDeploymentOverviewProps {
  snapshot: OpenBotDeploymentSnapshot;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const stateLabel: Record<OpenBotHealthState, string> = {
  healthy: 'Healthy',
  degraded: 'Needs attention',
  offline: 'Offline',
  unknown: 'Not reported',
};

function stateColors(
  state: OpenBotHealthState,
  colors: ReturnType<typeof useTheme>['theme']['colors'],
) {
  switch (state) {
    case 'healthy':
      return {
        foreground: colors.success,
        background: `${colors.success}18`,
      };
    case 'degraded':
      return {
        foreground: colors.warning,
        background: `${colors.warning}18`,
      };
    case 'offline':
      return {
        foreground: colors.error,
        background: `${colors.error}18`,
      };
    case 'unknown':
      return {
        foreground: colors.textMuted,
        background: colors.backgroundTertiary,
      };
  }
}

function StateIcon({ state }: { state: OpenBotHealthState }) {
  const Icon =
    state === 'healthy'
      ? Check
      : state === 'degraded'
        ? CircleAlert
        : state === 'offline'
          ? CircleX
          : Clock3;
  return <Icon size={14} aria-hidden="true" />;
}

function ComponentIcon({ id }: { id: OpenBotDeploymentComponent['id'] }) {
  if (id === 'api') return <Server size={16} aria-hidden="true" />;
  if (id === 'worker') return <Activity size={16} aria-hidden="true" />;
  if (id === 'database') return <Database size={16} aria-hidden="true" />;
  return <PrincipalMark size={16} />;
}

export function OpenBotDeploymentOverview({
  snapshot,
  refreshing = false,
  onRefresh,
}: OpenBotDeploymentOverviewProps) {
  const { theme } = useTheme();
  const { colors, space, radii, fontSizes, fontWeights, fonts } = theme;
  const checkedCount = snapshot.components.filter(
    ({ state }) => state !== 'unknown',
  ).length;
  const cardStyle: React.CSSProperties = {
    border: `1px solid ${colors.border}`,
    borderRadius: radii[4],
    background: colors.backgroundSecondary,
  };

  return (
    <section
      aria-label="OpenBot deployment monitoring"
      style={{
        width: '100%',
        maxWidth: 920,
        margin: '0 auto',
        padding: space[5],
        color: colors.text,
        fontFamily: fonts.body,
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: space[3],
          marginBottom: space[4],
        }}
      >
        <div>
          <div
            style={{
              marginBottom: space[1],
              color: colors.textMuted,
              fontSize: fontSizes[0],
              fontWeight: fontWeights.semibold,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Deployment monitoring
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: fontSizes[4],
              fontWeight: fontWeights.semibold,
            }}
          >
            OpenBot
          </h1>
          <p
            style={{
              margin: `${space[1]}px 0 0`,
              color: colors.textSecondary,
              fontSize: fontSizes[1],
            }}
          >
            A quick read on what is deployed, what is healthy, and whether
            inference is available.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[2],
          }}
        >
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh OpenBot deployment status"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: space[1],
                padding: `${space[1]}px ${space[2]}px`,
                border: `1px solid ${colors.border}`,
                borderRadius: radii[3],
                background: colors.backgroundTertiary,
                color: colors.text,
                fontFamily: fonts.body,
                fontSize: fontSizes[0],
                cursor: refreshing ? 'wait' : 'pointer',
                opacity: refreshing ? 0.7 : 1,
              }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              {refreshing ? 'Checking…' : 'Refresh'}
            </button>
          )}
          <StateBadge state={snapshot.state} />
        </div>
      </header>

      <section
        aria-label="Deployment identity"
        style={{
          ...cardStyle,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: space[3],
          padding: space[3],
          marginBottom: space[4],
        }}
      >
        <MetadataItem
          icon={<Server size={15} aria-hidden="true" />}
          label="Endpoint"
          value={snapshot.endpoint}
          theme={theme}
        />
        <MetadataItem
          icon={<GitBranch size={15} aria-hidden="true" />}
          label="Source"
          value={[snapshot.source, snapshot.branch, snapshot.revision]
            .filter(Boolean)
            .join(' · ')}
          theme={theme}
        />
        <MetadataItem
          icon={<Bot size={15} aria-hidden="true" />}
          label="Deployment"
          value={snapshot.deploymentMode}
          theme={theme}
        />
      </section>

      <section
        aria-labelledby="openbot-health-heading"
        style={{ marginBottom: space[4] }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: space[2],
            marginBottom: space[2],
          }}
        >
          <h2
            id="openbot-health-heading"
            style={{
              margin: 0,
              fontSize: fontSizes[2],
              fontWeight: fontWeights.semibold,
            }}
          >
            Component health
          </h2>
          <span style={{ color: colors.textMuted, fontSize: fontSizes[0] }}>
            {checkedCount} of {snapshot.components.length} checks reported ·
            checked {snapshot.checkedAt}
          </span>
        </div>
        <div style={cardStyle}>
          {snapshot.components.map((component, index) => (
            <ComponentRow
              key={component.id}
              component={component}
              theme={theme}
              last={index === snapshot.components.length - 1}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="openbot-events-heading">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[1],
            marginBottom: space[2],
          }}
        >
          <Clock3 size={15} color={colors.textMuted} aria-hidden="true" />
          <h2
            id="openbot-events-heading"
            style={{
              margin: 0,
              fontSize: fontSizes[2],
              fontWeight: fontWeights.semibold,
            }}
          >
            Recent events
          </h2>
        </div>
        <div style={cardStyle}>
          {snapshot.events.length > 0 ? (
            snapshot.events.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                theme={theme}
                last={index === snapshot.events.length - 1}
              />
            ))
          ) : (
            <p
              style={{
                margin: 0,
                padding: space[3],
                color: colors.textMuted,
                fontSize: fontSizes[1],
              }}
            >
              {snapshot.eventsMessage ?? 'No recent deployment events.'}
            </p>
          )}
        </div>
      </section>
      {snapshot.coverageNote && (
        <div
          role="note"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: space[2],
            marginTop: space[3],
            padding: space[2],
            borderRadius: radii[3],
            background: colors.backgroundTertiary,
            color: colors.textMuted,
            fontSize: fontSizes[0],
            lineHeight: theme.lineHeights.body,
          }}
        >
          <Info
            size={15}
            style={{ flex: '0 0 auto', marginTop: 1 }}
            aria-hidden="true"
          />
          <span>{snapshot.coverageNote}</span>
        </div>
      )}
    </section>
  );
}

function StateBadge({ state }: { state: OpenBotHealthState }) {
  const { theme } = useTheme();
  const tone = stateColors(state, theme.colors);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.space[1],
        padding: `${theme.space[1]}px ${theme.space[2]}px`,
        borderRadius: theme.radii[3],
        background: tone.background,
        color: tone.foreground,
        fontSize: theme.fontSizes[1],
        fontWeight: theme.fontWeights.medium,
        whiteSpace: 'nowrap',
      }}
    >
      <StateIcon state={state} />
      {state === 'unknown' ? 'Limited visibility' : stateLabel[state]}
    </span>
  );
}

function MetadataItem({
  icon,
  label,
  value,
  theme,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.space[1],
          marginBottom: theme.space[1],
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes[0],
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes[1],
          fontWeight: theme.fontWeights.medium,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ComponentRow({
  component,
  theme,
  last,
}: {
  component: OpenBotDeploymentComponent;
  theme: ReturnType<typeof useTheme>['theme'];
  last: boolean;
}) {
  const tone = stateColors(component.state, theme.colors);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.space[2],
        minHeight: 68,
        padding: `${theme.space[2]}px ${theme.space[3]}px`,
        borderBottom: last ? 'none' : `1px solid ${theme.colors.border}`,
      }}
    >
      <span
        style={{
          display: 'grid',
          width: 30,
          height: 30,
          flex: '0 0 auto',
          placeItems: 'center',
          borderRadius: theme.radii[3],
          background: theme.colors.backgroundTertiary,
          color: theme.colors.textSecondary,
        }}
      >
        <ComponentIcon id={component.id} />
      </span>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
          }}
        >
          {component.label}
        </div>
        <div
          style={{
            marginTop: theme.space[1],
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes[0],
          }}
        >
          {component.detail}
        </div>
      </div>
      {component.metric && (
        <span
          style={{
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[0],
          }}
        >
          {component.metric}
        </span>
      )}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.space[1],
          color: tone.foreground,
          fontSize: theme.fontSizes[0],
          fontWeight: theme.fontWeights.medium,
          whiteSpace: 'nowrap',
        }}
      >
        <StateIcon state={component.state} />
        {component.state === 'unknown'
          ? 'Not reported'
          : stateLabel[component.state]}
      </span>
    </div>
  );
}

function EventRow({
  event,
  theme,
  last,
}: {
  event: OpenBotDeploymentEvent;
  theme: ReturnType<typeof useTheme>['theme'];
  last: boolean;
}) {
  const tone = stateColors(event.state, theme.colors);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.space[2],
        padding: `${theme.space[2]}px ${theme.space[3]}px`,
        borderBottom: last ? 'none' : `1px solid ${theme.colors.border}`,
      }}
    >
      <span style={{ marginTop: 2, color: tone.foreground }}>
        <StateIcon state={event.state} />
      </span>
      <div>
        <div
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
          }}
        >
          {event.title}
        </div>
        <div
          style={{
            marginTop: theme.space[1],
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes[0],
          }}
        >
          {event.detail}
        </div>
      </div>
    </div>
  );
}

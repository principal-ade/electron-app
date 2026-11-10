import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  ShellService,
  type StudioStatusResult,
} from '../../../main-process-api/ShellService';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { PackageManagerService } from '../../../main-process-api/PackageManagerService';
import { repoPurlFromEntry } from '../../../../shared/topics/repoPurl';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Bot,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  Command,
  Database,
  HardDrive,
  Play,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Square,
  Terminal,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { RepositoryAvatar } from '../../../components/repository-maps/RepositoryAvatar';

type Scenario = 'healthy' | 'update-available' | 'not-installed';
type IntegrationId = 'maple' | 'studio' | 'studio-dev' | 'openbot';
type Theme = ReturnType<typeof useTheme>['theme'];

interface IntegrationState {
  installed: boolean;
  running: boolean;
  enabled: boolean;
  version: string;
}

interface IntegrationsViewProps {
  /** Fixture-only states for exploring this UI before IntegrationManager exists. */
  scenario?: Scenario;
  /** Optional registration override for Storybook and embedding callers. */
  studioCloneRegistered?: boolean;
  /** Selects an integration on first render, primarily for Storybook previews. */
  initialIntegration?: IntegrationId;
  /** Hide the standalone page header when embedded in System Monitor. */
  showHeader?: boolean;
}

const scenarioState: Record<
  Scenario,
  Record<IntegrationId, IntegrationState>
> = {
  healthy: {
    maple: { installed: true, running: true, enabled: true, version: '1.4.2' },
    studio: {
      installed: true,
      running: false,
      enabled: true,
      version: '0.18.6',
    },
    'studio-dev': {
      installed: true,
      running: false,
      enabled: true,
      version: '0.19.0-dev',
    },
    openbot: {
      installed: true,
      running: true,
      enabled: true,
      version: '',
    },
  },
  'update-available': {
    maple: { installed: true, running: true, enabled: true, version: '1.3.8' },
    studio: {
      installed: true,
      running: false,
      enabled: true,
      version: '0.18.6',
    },
    'studio-dev': {
      installed: true,
      running: false,
      enabled: true,
      version: '0.19.0-dev',
    },
    openbot: {
      installed: true,
      running: true,
      enabled: true,
      version: '',
    },
  },
  'not-installed': {
    maple: { installed: false, running: false, enabled: false, version: '' },
    studio: {
      installed: true,
      running: false,
      enabled: true,
      version: '0.18.6',
    },
    'studio-dev': {
      installed: true,
      running: false,
      enabled: true,
      version: '0.19.0-dev',
    },
    openbot: {
      installed: true,
      running: true,
      enabled: true,
      version: '',
    },
  },
};

const repositoryOwners: Record<IntegrationId, string> = {
  maple: 'MapleTechLabs',
  studio: 'principal-ai',
  'studio-dev': 'principal-ai',
  openbot: 'CopilotKit',
};

/** Production starts with no Studio facts until the main process reports them. */
const unresolvedStudioState: IntegrationState = {
  installed: false,
  running: false,
  enabled: true,
  version: '',
};

const MAPLE_DASHBOARD_URL = 'https://local.maple.dev/?port=4318';
const STUDIO_REPOSITORY_PURL = 'pkg:github/principal-ai/subsystem-modeling';

function isSubsystemModelingRepository(entry: AlexandriaEntry): boolean {
  return repoPurlFromEntry(entry)?.toLowerCase() === STUDIO_REPOSITORY_PURL;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  scenario,
  studioCloneRegistered,
  initialIntegration,
  showHeader = true,
}) => {
  const { theme } = useTheme();
  const [registeredStudioRepoPath, setRegisteredStudioRepoPath] = useState<
    string | undefined
  >();
  const showStudioDev = studioCloneRegistered ?? !!registeredStudioRepoPath;
  const [selected, setSelected] = useState<IntegrationId>(() => {
    if (
      initialIntegration &&
      (studioCloneRegistered === true || initialIntegration !== 'studio-dev')
    ) {
      return initialIntegration;
    }
    return 'maple';
  });
  const [integrations, setIntegrations] = useState(() => {
    const initial = scenarioState[scenario ?? 'healthy'];
    if (scenario !== undefined) return initial;
    return {
      ...initial,
      studio: { ...unresolvedStudioState },
      'studio-dev': { ...unresolvedStudioState },
    };
  });
  const [notice, setNotice] = useState('');
  const [studioActionLoading, setStudioActionLoading] = useState(false);
  const [studioInstalling, setStudioInstalling] = useState(false);
  const [studioUpdate, setStudioUpdate] = useState<{
    latestVersion: string;
    isOutdated: boolean;
  } | null>(null);
  const [studioUpdateChecking, setStudioUpdateChecking] = useState(false);
  const isFixture = scenario !== undefined;
  const [studioStatusChecking, setStudioStatusChecking] = useState(
    scenario === undefined,
  );

  const refreshStudioUpdate = useCallback(
    async (status: StudioStatusResult) => {
      if (scenario !== undefined) return;
      const installed = status.installed;
      if (!installed.available) {
        setStudioUpdate(null);
        return;
      }

      const currentVersion = installed.version ?? '0.0.0';
      const packageName = '@principal-ai/subsystems-studio';
      setStudioUpdateChecking(true);
      try {
        const [result] = await PackageManagerService.checkVersions(
          [{ name: packageName, currentVersion }],
          'npm',
        );
        if (result?.latestVersion && !result.error) {
          setStudioUpdate({
            latestVersion: result.latestVersion,
            // An unreadable install version should still surface a repair path.
            isOutdated: installed.version ? result.isOutdated : true,
          });
        } else {
          setStudioUpdate(null);
        }
      } catch {
        setStudioUpdate(null);
      } finally {
        setStudioUpdateChecking(false);
      }
    },
    [scenario],
  );

  const refreshStudioStatus = useCallback(async () => {
    if (scenario !== undefined) return;
    setStudioStatusChecking(true);
    try {
      const status: StudioStatusResult = await ShellService.getStudioStatus({
        devPath: registeredStudioRepoPath,
      });
      setIntegrations((previous) => ({
        ...previous,
        studio: {
          ...previous.studio,
          installed: status.installed.available,
          running: status.running && status.mode !== 'dev',
          version: status.installed.version ?? '',
        },
        'studio-dev': {
          ...previous['studio-dev'],
          installed: status.dev.available,
          running: status.running && status.mode === 'dev',
          version: status.dev.version ?? '',
        },
      }));
      void refreshStudioUpdate(status);
    } catch {
      setIntegrations((previous) => ({
        ...previous,
        studio: { ...previous.studio, running: false },
        'studio-dev': { ...previous['studio-dev'], running: false },
      }));
      setStudioUpdate(null);
    } finally {
      setStudioStatusChecking(false);
    }
  }, [scenario, registeredStudioRepoPath, refreshStudioUpdate]);

  useEffect(() => {
    void refreshStudioStatus();
  }, [refreshStudioStatus]);

  useEffect(() => {
    if (studioCloneRegistered !== undefined) {
      setRegisteredStudioRepoPath(undefined);
      return;
    }

    let cancelled = false;
    const refreshRegisteredRepos = async () => {
      try {
        const repositories = await AlexandriaService.getRepositories();
        const studioRepository = repositories.find(
          isSubsystemModelingRepository,
        );
        if (!cancelled) {
          setRegisteredStudioRepoPath(studioRepository?.path);
        }
      } catch {
        if (!cancelled) setRegisteredStudioRepoPath(undefined);
      }
    };

    void refreshRegisteredRepos();
    const unsubscribe = AlexandriaService.onRepositoryChange(() => {
      void refreshRegisteredRepos();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [studioCloneRegistered]);

  useEffect(() => {
    if (!showStudioDev && selected === 'studio-dev') setSelected('studio');
  }, [selected, showStudioDev]);

  const maple = integrations.maple;
  const studio = integrations.studio;
  const studioDev = integrations['studio-dev'];
  const isMaple = selected === 'maple';
  const isStudioDev = selected === 'studio-dev';
  const isOpenBot = selected === 'openbot';
  const activeStudio = isStudioDev ? studioDev : studio;
  const current = integrations[selected];
  const updateAvailable = scenario === 'update-available' && maple.installed;
  const space = theme.space;
  const colors = theme.colors;
  const fontSizes = theme.fontSizes;

  const setIntegration = (
    id: IntegrationId,
    update: Partial<IntegrationState>,
  ) => {
    setIntegrations((previous) => ({
      ...previous,
      [id]: { ...previous[id], ...update },
    }));
  };

  const showPrototypeNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3200);
  };

  const handleStudioAction = async () => {
    if (isFixture) {
      setIntegration(selected, { running: !current.running });
      return;
    }

    setStudioActionLoading(true);
    try {
      const result = await ShellService.launchStudio({
        // The CLI's open-studio command focuses whichever build owns the IPC
        // socket when Studio is already running.
        mode: current.running ? 'installed' : isStudioDev ? 'dev' : 'installed',
        devPath: isStudioDev ? registeredStudioRepoPath : undefined,
      });
      if (!result.success) {
        showPrototypeNotice(
          result.error ?? 'Could not open Subsystems Studio.',
        );
        return;
      }
      window.setTimeout(() => void refreshStudioStatus(), 1200);
    } catch (error) {
      showPrototypeNotice(
        error instanceof Error
          ? error.message
          : 'Could not open Subsystems Studio.',
      );
    } finally {
      setStudioActionLoading(false);
    }
  };

  const handleStudioInstall = async () => {
    if (isFixture) {
      showPrototypeNotice('Update flow preview — no files were changed.');
      return;
    }

    setStudioInstalling(true);
    try {
      const wasInstalled = studio.installed;
      const wasRunning = studio.running;
      const result = await ShellService.installStudio({
        mode: 'installed',
        restart: wasRunning,
      });
      if (result.cancelled) return;

      if (!result.success) {
        showPrototypeNotice(
          result.error ?? 'Could not install Subsystems Studio.',
        );
        await refreshStudioStatus();
        return;
      }

      const versionLabel = result.version ? ` ${result.version}` : '';
      if (result.restarted) {
        showPrototypeNotice(
          `Subsystems Studio${versionLabel} is updated and running.`,
        );
      } else if (wasInstalled) {
        const restartNote = wasRunning
          ? ` ${result.restartError ?? 'Restart Studio to use it.'}`
          : '';
        showPrototypeNotice(
          `Subsystems Studio${versionLabel} is updated.${restartNote}`,
        );
      } else {
        showPrototypeNotice(`Subsystems Studio${versionLabel} is installed.`);
      }
      await refreshStudioStatus();
    } catch (error) {
      showPrototypeNotice(
        error instanceof Error
          ? error.message
          : 'Could not install Subsystems Studio.',
      );
    } finally {
      setStudioInstalling(false);
    }
  };

  const surfaceStyle: React.CSSProperties = {
    background: colors.backgroundSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: theme.radii[4],
  };

  const secondaryButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: 36,
    padding: `0 ${space[2]}px`,
    border: `1px solid ${colors.border}`,
    borderRadius: theme.radii[4],
    background: colors.backgroundTertiary,
    color: colors.text,
    fontFamily: theme.fonts.body,
    fontSize: fontSizes[1],
    fontWeight: theme.fontWeights.medium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...secondaryButtonStyle,
    borderColor: colors.primary,
    background: colors.primary,
    color: colors.textOnPrimary,
  };

  const statusLabel = (id: IntegrationId) => {
    const value = integrations[id];
    if (!value.installed) return 'Not installed';
    if (id === 'openbot') return value.running ? 'Connected' : 'Not connected';
    if (
      scenario === undefined &&
      studioStatusChecking &&
      (id === 'studio' || id === 'studio-dev')
    ) {
      return 'Checking';
    }
    if (value.running) return 'Running';
    return id === 'maple' ? 'Stopped' : 'Ready to launch';
  };

  const statusColor = (id: IntegrationId) => {
    const value = integrations[id];
    if (
      scenario === undefined &&
      studioStatusChecking &&
      (id === 'studio' || id === 'studio-dev')
    ) {
      return colors.textMuted;
    }
    if (value.running) return colors.success;
    if (!value.installed) return colors.textMuted;
    return id === 'openbot' ? colors.warning : colors.textSecondary;
  };

  const renderNavItem = (id: IntegrationId) => {
    const active = selected === id;
    const repositoryOwner = repositoryOwners[id];
    const label =
      id === 'maple'
        ? 'Maple'
        : id === 'openbot'
          ? 'OpenBot'
          : id === 'studio-dev'
            ? 'Subsystems Studio Dev'
            : 'Subsystems Studio';
    return (
      <button
        key={id}
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => setSelected(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[2] + space[1],
          width: '100%',
          padding: `${space[2] + space[1]}px ${space[3]}px`,
          border: 'none',
          borderRadius: theme.radii[4],
          background: active ? `${colors.primary}20` : 'transparent',
          color: active ? colors.primary : colors.text,
          fontFamily: theme.fonts.body,
          fontSize: fontSizes[1],
          fontWeight: active
            ? theme.fontWeights.semibold
            : theme.fontWeights.medium,
          textAlign: 'left',
          cursor: 'pointer',
        }}
        onMouseEnter={(event) => {
          if (!active) {
            event.currentTarget.style.backgroundColor =
              colors.backgroundTertiary;
          }
        }}
        onMouseLeave={(event) => {
          if (!active)
            event.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <RepositoryAvatar
          type="owner"
          size={28}
          customAvatarUrl={`https://github.com/${repositoryOwner}.png`}
          alt=""
        />
        <span style={{ flex: 1 }}>{label}</span>
      </button>
    );
  };

  const renderSettingRow = (options: {
    icon: React.ReactNode;
    label: string;
    description: string;
    value?: React.ReactNode;
    action?: React.ReactNode;
    last?: boolean;
  }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        minHeight: 66,
        padding: `${space[2]}px ${space[3]}px`,
        borderBottom: options.last ? 'none' : `1px solid ${colors.border}`,
      }}
    >
      <span
        style={{
          display: 'grid',
          width: 32,
          height: 32,
          flex: '0 0 auto',
          placeItems: 'center',
          borderRadius: theme.radii[3],
          background: colors.backgroundTertiary,
          color: colors.textSecondary,
        }}
      >
        {options.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: colors.text,
            fontSize: fontSizes[1],
            fontWeight: theme.fontWeights.medium,
          }}
        >
          {options.label}
        </div>
        <div
          style={{
            marginTop: space[1],
            color: colors.textMuted,
            fontSize: fontSizes[1],
            lineHeight: theme.lineHeights.body,
          }}
        >
          {options.description}
        </div>
      </div>
      {options.value && (
        <div
          style={{
            minWidth: 0,
            maxWidth: theme.sizes[4],
            color: colors.textSecondary,
            fontFamily: theme.fonts.monospace,
            fontSize: fontSizes[1],
            textAlign: 'right',
            overflowWrap: 'anywhere',
          }}
        >
          {options.value}
        </div>
      )}
      {options.action}
    </div>
  );

  return (
    <main
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 560,
        flexDirection: 'column',
        overflow: 'hidden',
        background: colors.background,
        color: colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      {showHeader && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[2],
            flex: '0 0 auto',
            padding: `${space[3]}px ${space[4]}px`,
            borderBottom: `1px solid ${colors.border}`,
            background: colors.backgroundSecondary,
          }}
        >
          <Settings2 size={20} color={colors.primary} />
          <h1
            style={{
              margin: 0,
              color: colors.text,
              fontFamily: theme.fonts.heading,
              fontSize: fontSizes[3],
              fontWeight: theme.fontWeights.heading,
            }}
          >
            Integrations
          </h1>
          <span
            style={{
              marginLeft: space[1],
              padding: `${space[1]}px ${space[2]}px`,
              border: `1px solid ${colors.border}`,
              borderRadius: theme.radii[2],
              color: colors.textMuted,
              fontSize: fontSizes[1],
              fontWeight: theme.fontWeights.semibold,
            }}
          >
            PREVIEW
          </span>
          <button
            type="button"
            onClick={() => void refreshStudioStatus()}
            style={{ ...secondaryButtonStyle, marginLeft: 'auto' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </header>
      )}

      <div
        style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <aside
          aria-label="Integration navigation"
          style={{
            width: 240,
            flex: '0 0 240px',
            padding: space[3],
            borderRight: `1px solid ${colors.border}`,
            background: colors.backgroundSecondary,
          }}
        >
          <nav
            style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}
          >
            {renderNavItem('maple')}
            {renderNavItem('studio')}
            {showStudioDev && renderNavItem('studio-dev')}
            {renderNavItem('openbot')}
          </nav>
        </aside>

        <section
          aria-label={`${isMaple ? 'Maple' : isOpenBot ? 'OpenBot' : isStudioDev ? 'Subsystems Studio Dev' : 'Subsystems Studio'} settings`}
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            padding: `${space[4]}px`,
          }}
        >
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: space[3],
                marginBottom: space[3],
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color: colors.text,
                    fontFamily: theme.fonts.heading,
                    fontSize: fontSizes[4],
                    fontWeight: theme.fontWeights.heading,
                  }}
                >
                  {isMaple
                    ? 'Maple'
                    : isOpenBot
                      ? 'OpenBot'
                      : isStudioDev
                        ? 'Subsystems Studio Dev'
                        : 'Subsystems Studio'}
                </h2>
                <p
                  style={{
                    margin: `${space[1]}px 0 0`,
                    color: colors.textMuted,
                    fontSize: fontSizes[1],
                    lineHeight: theme.lineHeights.body,
                  }}
                >
                  {isMaple
                    ? 'Local telemetry collection, storage, and service.'
                    : isOpenBot
                      ? 'Local AI chat available from a Principal workspace tab.'
                      : isStudioDev
                        ? 'Development build launched from a registered Studio source clone.'
                        : 'Explore subsystem models with the published Studio app.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: space[2] }}>
                {isMaple && current.running && (
                  <button
                    type="button"
                    onClick={() =>
                      void ShellService.openExternal(MAPLE_DASHBOARD_URL)
                    }
                    style={secondaryButtonStyle}
                  >
                    Open Maple
                  </button>
                )}
                {isMaple && updateAvailable && (
                  <button
                    type="button"
                    onClick={() =>
                      showPrototypeNotice(
                        'Update flow preview — no files were changed.',
                      )
                    }
                    style={secondaryButtonStyle}
                  >
                    <ArrowDownToLine size={14} /> Review update
                  </button>
                )}
                {!isMaple &&
                  !isOpenBot &&
                  !isStudioDev &&
                  studioUpdate?.isOutdated && (
                    <button
                      type="button"
                      onClick={() => void handleStudioInstall()}
                      disabled={studioInstalling}
                      style={secondaryButtonStyle}
                    >
                      <ArrowDownToLine size={14} />
                      {studioInstalling
                        ? 'Updating…'
                        : studio.running
                          ? 'Update & restart'
                          : `Update to ${studioUpdate.latestVersion}`}
                    </button>
                  )}
                {isOpenBot ? (
                  <button
                    type="button"
                    onClick={() =>
                      showPrototypeNotice(
                        'OpenBot chat is available from the workspace title bar.',
                      )
                    }
                    style={primaryButtonStyle}
                  >
                    <ArrowUpRight size={14} /> Open chat
                  </button>
                ) : !current.installed ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isMaple) {
                        showPrototypeNotice(
                          'Install flow preview — no software was installed.',
                        );
                      } else if (isStudioDev) {
                        showPrototypeNotice(
                          'Register a Studio source clone before launching Studio Dev.',
                        );
                      } else {
                        void handleStudioInstall();
                      }
                    }}
                    disabled={
                      studioInstalling ||
                      (scenario === undefined && studioStatusChecking)
                    }
                    style={primaryButtonStyle}
                  >
                    <ArrowDownToLine size={14} />
                    {!isMaple && scenario === undefined && studioStatusChecking
                      ? 'Checking Studio…'
                      : studioInstalling
                        ? 'Installing…'
                        : isMaple
                          ? 'Install Maple'
                          : isStudioDev
                            ? 'Dev build not found'
                            : 'Install Studio'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      isMaple
                        ? setIntegration(selected, {
                            running: !current.running,
                          })
                        : void handleStudioAction()
                    }
                    disabled={
                      studioActionLoading ||
                      (!isMaple &&
                        scenario === undefined &&
                        studioStatusChecking)
                    }
                    style={primaryButtonStyle}
                  >
                    {!isMaple &&
                    scenario === undefined &&
                    studioStatusChecking ? (
                      'Checking Studio…'
                    ) : current.running ? (
                      isMaple ? (
                        <>
                          <Square size={13} fill="currentColor" /> Stop service
                        </>
                      ) : (
                        <>
                          <ArrowUpRight size={14} />
                          {isStudioDev ? 'Focus Studio Dev' : 'Focus Studio'}
                        </>
                      )
                    ) : (
                      <>
                        <Play size={14} fill="currentColor" />
                        {isMaple
                          ? 'Start service'
                          : isStudioDev
                            ? 'Launch Studio Dev'
                            : 'Launch Studio'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {scenario === 'not-installed' && isMaple && (
              <div
                style={{
                  ...surfaceStyle,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: space[2],
                  marginBottom: space[3],
                  padding: space[2],
                }}
              >
                <CircleAlert
                  size={16}
                  color={colors.warning}
                  style={{ marginTop: 2, flex: '0 0 auto' }}
                />
                <div>
                  <div
                    style={{
                      color: colors.text,
                      fontSize: fontSizes[1],
                      fontWeight: theme.fontWeights.semibold,
                    }}
                  >
                    Maple isn’t installed yet
                  </div>
                  <div
                    style={{
                      marginTop: space[1],
                      color: colors.textMuted,
                      fontSize: fontSizes[1],
                    }}
                  >
                    Install management is a design preview. No software will be
                    downloaded or run.
                  </div>
                </div>
              </div>
            )}

            {updateAvailable && isMaple && (
              <div
                style={{
                  ...surfaceStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[2],
                  marginBottom: space[3],
                  padding: space[2],
                  color: colors.warning,
                }}
              >
                <ArrowDownToLine size={16} />
                <span style={{ fontSize: fontSizes[1] }}>
                  Version 1.4.2 is ready to review
                </span>
              </div>
            )}

            {!isMaple &&
              !isOpenBot &&
              !isStudioDev &&
              current.installed &&
              studioUpdate?.isOutdated && (
                <div
                  style={{
                    ...surfaceStyle,
                    display: 'flex',
                    alignItems: 'center',
                    gap: space[2],
                    marginBottom: space[3],
                    padding: space[2],
                    color: colors.warning,
                  }}
                >
                  <ArrowDownToLine size={16} />
                  <span style={{ fontSize: fontSizes[1] }}>
                    Version {studioUpdate.latestVersion} is available
                    {current.version ? ` — you have ${current.version}` : ''}
                    {studio.running ? '. Updating restarts Studio.' : ''}
                  </span>
                  {studioUpdateChecking && (
                    <span
                      style={{
                        color: colors.textMuted,
                        fontSize: fontSizes[1],
                      }}
                    >
                      Checking…
                    </span>
                  )}
                </div>
              )}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: space[2],
                marginBottom: space[3],
              }}
            >
              <StatusBadge
                icon={<Settings2 size={14} />}
                label={
                  isOpenBot
                    ? 'Local chat bridge'
                    : scenario === undefined && studioStatusChecking && !isMaple
                      ? 'Checking'
                      : isStudioDev
                        ? current.installed
                          ? current.version
                            ? `Version ${current.version}`
                            : 'Version unknown'
                          : 'No dev build found'
                        : current.installed
                          ? current.version
                            ? `Version ${current.version}`
                            : 'Version unknown'
                          : 'No version installed'
                }
                color={colors.textSecondary}
                theme={theme}
              />
              <StatusBadge
                icon={
                  current.running ? (
                    <CircleCheck size={14} />
                  ) : (
                    <Clock3 size={14} />
                  )
                }
                label={statusLabel(selected)}
                color={statusColor(selected)}
                theme={theme}
              />
            </div>

            {isMaple ? (
              <>
                <SectionHeading theme={theme}>Service</SectionHeading>
                <div style={surfaceStyle}>
                  {renderSettingRow({
                    icon: <Activity size={16} />,
                    label: 'Local endpoint',
                    description: 'OTLP receiver bound to this device only.',
                    value: '127.0.0.1:4318',
                    last: true,
                  })}
                </div>

                <SectionHeading theme={theme}>Startup</SectionHeading>
                <div style={surfaceStyle}>
                  {renderSettingRow({
                    icon: <Server size={16} />,
                    label: 'Start Maple when Principal opens',
                    description:
                      'Keep the local telemetry service available in the background.',
                    action: (
                      <button
                        type="button"
                        aria-pressed={maple.enabled}
                        onClick={() =>
                          setIntegration('maple', { enabled: !maple.enabled })
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: space[1],
                          padding: space[1],
                          border: 0,
                          background: 'transparent',
                          color: maple.enabled
                            ? colors.primary
                            : colors.textMuted,
                          fontFamily: theme.fonts.body,
                          fontSize: fontSizes[1],
                          cursor: 'pointer',
                        }}
                      >
                        {maple.enabled ? (
                          <ToggleRight size={20} />
                        ) : (
                          <ToggleLeft size={20} />
                        )}
                        {maple.enabled ? 'On' : 'Off'}
                      </button>
                    ),
                    last: true,
                  })}
                </div>

                <SectionHeading theme={theme}>Data</SectionHeading>
                <div style={surfaceStyle}>
                  {renderSettingRow({
                    icon: <Database size={16} />,
                    label: 'Data location',
                    description:
                      'Telemetry data is kept separately from the Maple application.',
                    value: '~/Library/Application Support/Maple',
                    last: true,
                  })}
                </div>

                <SectionHeading theme={theme}>Recent activity</SectionHeading>
                <div style={surfaceStyle}>
                  <ActivityItem
                    icon={<Check size={14} />}
                    color={colors.success}
                    title="Maple health check passed"
                    detail="OTLP receiver listening on 127.0.0.1:4318"
                    theme={theme}
                  />
                  <ActivityItem
                    icon={<Terminal size={14} />}
                    color={colors.textSecondary}
                    title="Service started"
                    detail="Today · managed by Principal"
                    theme={theme}
                    last
                  />
                </div>
              </>
            ) : isOpenBot ? (
              <>
                <SectionHeading theme={theme}>Connection</SectionHeading>
                <div style={surfaceStyle}>
                  {renderSettingRow({
                    icon: <Server size={16} />,
                    label: 'Local service',
                    description:
                      'Principal connects to the local OpenBot service through its native chat bridge.',
                    value: 'http://localhost:3010',
                    last: true,
                  })}
                </div>

                <SectionHeading theme={theme}>
                  OpenBot in Principal
                </SectionHeading>
                <div style={surfaceStyle}>
                  {renderSettingRow({
                    icon: <Bot size={16} />,
                    label: 'Native chat',
                    description:
                      'Open conversations in a workspace tab and continue working in context.',
                    value: 'Workspace tab',
                    last: true,
                  })}
                </div>

                <SectionHeading theme={theme}>Recent activity</SectionHeading>
                <div style={surfaceStyle}>
                  <ActivityItem
                    icon={<CircleCheck size={14} />}
                    color={colors.success}
                    title="OpenBot chat bridge is ready"
                    detail="Local endpoint · localhost:3010"
                    theme={theme}
                    last
                  />
                </div>
              </>
            ) : (
              <>
                <SectionHeading theme={theme}>Launch behavior</SectionHeading>
                <div style={surfaceStyle}>
                  {renderSettingRow({
                    icon: <Play size={16} />,
                    label: 'On demand',
                    description: isStudioDev
                      ? 'Studio Dev starts from the registered source clone only when launched.'
                      : 'Studio is launched on demand and does not run as a background service.',
                    value: activeStudio.running ? 'Running' : 'Not running',
                    last: true,
                  })}
                </div>

                <SectionHeading theme={theme}>Launch source</SectionHeading>
                <div style={surfaceStyle}>
                  {renderSettingRow({
                    icon: <HardDrive size={16} />,
                    label: isStudioDev ? 'Registered source clone' : 'Package',
                    description: isStudioDev
                      ? 'The development entry is available because a Studio repository clone is registered.'
                      : activeStudio.installed
                        ? 'Published npm package, launched through the Principal Studio CLI.'
                        : 'Not installed. Install the published package to launch Studio.',
                    value: isStudioDev
                      ? activeStudio.installed
                        ? 'packages/subsystems-studio'
                        : 'Not registered'
                      : activeStudio.installed
                        ? '@principal-ai/subsystems-studio'
                        : 'Not installed yet',
                  })}
                  {renderSettingRow({
                    icon: <ShieldCheck size={16} />,
                    label: 'Launch command',
                    description: isStudioDev
                      ? 'Run from the root of the registered subsystem-modeling checkout.'
                      : 'Opens or focuses the published Studio application.',
                    value: isStudioDev
                      ? 'bun run dev:studio'
                      : 'npx @principal-ai/principal-studio-cli open-studio',
                    last: true,
                  })}
                </div>

                <SectionHeading theme={theme}>Recent activity</SectionHeading>
                <div style={surfaceStyle}>
                  <ActivityItem
                    icon={<Command size={14} />}
                    color={colors.primary}
                    title={
                      isStudioDev
                        ? activeStudio.installed
                          ? 'Subsystems Studio Dev is ready'
                          : 'Subsystems Studio Dev is not registered'
                        : activeStudio.installed
                          ? 'Subsystems Studio is ready'
                          : 'Subsystems Studio is not installed'
                    }
                    detail={
                      isStudioDev
                        ? activeStudio.version
                          ? `Development build · version ${activeStudio.version}`
                          : 'Development build · registered source clone'
                        : activeStudio.version
                          ? `Published npm package · version ${activeStudio.version}`
                          : activeStudio.installed
                            ? 'Published npm package · version unknown'
                            : 'Published npm package · not installed'
                    }
                    theme={theme}
                    last
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    showPrototypeNotice(
                      `${isStudioDev ? 'Studio Dev' : 'Studio'} model actions are not connected yet.`,
                    )
                  }
                  style={{ ...secondaryButtonStyle, marginTop: space[3] }}
                >
                  <ArrowUpRight size={14} /> Open recent model
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      {notice && (
        <div
          role="status"
          style={{
            position: 'fixed',
            right: space[3],
            bottom: space[3],
            zIndex: theme.zIndices[3],
            maxWidth: theme.sizes[3],
            padding: `${space[2]}px ${space[3]}px`,
            border: `1px solid ${colors.border}`,
            borderRadius: theme.radii[4],
            background: colors.backgroundTertiary,
            color: colors.text,
            boxShadow: theme.shadows[2],
            fontSize: fontSizes[1],
          }}
        >
          {notice}
        </div>
      )}
    </main>
  );
};

const SectionHeading: React.FC<{ theme: Theme; children: React.ReactNode }> = ({
  theme,
  children,
}) => (
  <h3
    style={{
      margin: `${theme.space[4]}px 0 ${theme.space[2]}px`,
      color: theme.colors.text,
      fontFamily: theme.fonts.heading,
      fontSize: theme.fontSizes[1],
      fontWeight: theme.fontWeights.semibold,
    }}
  >
    {children}
  </h3>
);

const StatusBadge: React.FC<{
  icon: React.ReactNode;
  label: string;
  color: string;
  theme: Theme;
}> = ({ icon, label, color, theme }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.space[1],
      padding: `${theme.space[1]}px ${theme.space[2]}px`,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radii[3],
      background: theme.colors.backgroundSecondary,
      color,
      fontSize: theme.fontSizes[1],
      fontWeight: theme.fontWeights.medium,
    }}
  >
    {icon}
    {label}
  </span>
);

const ActivityItem: React.FC<{
  icon: React.ReactNode;
  color: string;
  title: string;
  detail: string;
  theme: Theme;
  last?: boolean;
}> = ({ icon, color, title, detail, theme, last }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: theme.space[2],
      padding: `${theme.space[2]}px ${theme.space[3]}px`,
      borderBottom: last ? 'none' : `1px solid ${theme.colors.border}`,
    }}
  >
    <span style={{ display: 'inline-flex', color }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes[1],
          fontWeight: theme.fontWeights.medium,
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: theme.space[1],
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes[1],
        }}
      >
        {detail}
      </div>
    </div>
  </div>
);

export default IntegrationsView;

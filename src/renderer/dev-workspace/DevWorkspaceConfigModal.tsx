import React, { useEffect, useState } from 'react';
import { X, Copy, Check, FolderOpen } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { UserPreferences } from '../../shared/types/userPreferences.types';

type TitlebarConfig = NonNullable<
  NonNullable<UserPreferences['devWorkspace']>['titlebar']
>;
type LeftSidebarConfig = NonNullable<
  NonNullable<UserPreferences['devWorkspace']>['leftSidebarIcons']
>;
type RightSidebarConfig = NonNullable<
  NonNullable<UserPreferences['devWorkspace']>['rightSidebarIcons']
>;

export interface DevWorkspaceConfig {
  titlebar: Required<TitlebarConfig>;
  leftSidebarIcons: Required<LeftSidebarConfig>;
  rightSidebarIcons: Required<RightSidebarConfig>;
}

const TITLEBAR_BUTTON_LABELS: { key: keyof TitlebarConfig; label: string }[] = [
  { key: 'fileCity3D', label: '3D City button' },
  { key: 'trail', label: 'Trail button' },
  { key: 'traces', label: 'Traces dropdown' },
  { key: 'sync', label: 'Sync button' },
  { key: 'focus', label: 'Focus mode button' },
  { key: 'notes', label: 'Notes button' },
  { key: 'gitConfig', label: 'Git Config button' },
  { key: 'storybook', label: 'Storybook button' },
];

const LEFT_ICON_LABELS: { key: keyof LeftSidebarConfig; label: string }[] = [
  { key: 'files', label: 'Files' },
  { key: 'terminalSessions', label: 'Terminal sessions' },
  { key: 'packageComposition', label: 'Package info' },
  { key: 'docs', label: 'Docs' },
  { key: 'agentsList', label: 'Skills / Agents' },
  { key: 'trails', label: 'Trails' },
];

const RIGHT_ICON_LABELS: { key: keyof RightSidebarConfig; label: string }[] = [
  { key: 'fileCity', label: 'File City' },
  { key: 'codeQuality', label: 'Quality' },
  { key: 'kanban', label: 'Backlog' },
  { key: 'bruno', label: 'Bruno' },
];

export interface DevWorkspaceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DevWorkspaceConfig;
  onChange: (next: DevWorkspaceConfig) => void;
  /** Repository path — when provided, "Copy path" action is shown */
  repositoryPath?: string;
  /** Reveal repo in Finder — when provided, "Open in Finder" action is shown */
  onOpenInFinder?: () => void;
}

export const DevWorkspaceConfigModal: React.FC<
  DevWorkspaceConfigModalProps
> = ({ isOpen, onClose, config, onChange, repositoryPath, onOpenInFinder }) => {
  const { theme } = useTheme();
  const [draft, setDraft] = useState<DevWorkspaceConfig>(config);
  const [copied, setCopied] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);

  useEffect(() => {
    if (isOpen) setDraft(config);
  }, [isOpen, config]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = (next: DevWorkspaceConfig) => {
    setDraft(next);
    onChange(next);
  };

  const handleCopyPath = async () => {
    if (!repositoryPath) return;
    try {
      await navigator.clipboard.writeText(repositoryPath);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    } catch (error) {
      console.error('[DevWorkspaceConfigModal] Failed to copy path:', error);
    }
  };

  const handleCopyEnabled = async () => {
    const enabledIn = <K extends string>(
      items: { key: K; label: string }[],
      values: Record<K, boolean>,
    ) =>
      items
        .filter(({ key }) => values[key])
        .map(({ label }) => `- ${label}`)
        .join('\n') || '- (none)';

    const text = [
      'Dev Workspace — proposed defaults',
      '',
      'Titlebar buttons:',
      enabledIn(TITLEBAR_BUTTON_LABELS, draft.titlebar),
      '',
      'Left sidebar icons:',
      enabledIn(LEFT_ICON_LABELS, draft.leftSidebarIcons),
      '',
      'Right sidebar icons:',
      enabledIn(RIGHT_ICON_LABELS, draft.rightSidebarIcons),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[DevWorkspaceConfigModal] Failed to copy enabled list:', error);
    }
  };

  const renderSection = <K extends string>(
    title: string,
    items: { key: K; label: string }[],
    values: Record<K, boolean>,
    onToggle: (key: K, value: boolean) => void,
  ) => (
    <div style={{ marginBottom: '20px' }}>
      <h3
        style={{
          fontSize: `${theme.fontSizes[2]}px`,
          fontWeight: theme.fontWeights.semibold,
          fontFamily: theme.fonts.body,
          color: theme.colors.text,
          margin: '0 0 10px 0',
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 16px',
        }}
      >
        {items.map(({ key, label }) => (
          <label
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: theme.colors.text,
              fontSize: `${theme.fontSizes[1]}px`,
              fontFamily: theme.fonts.body,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <input
              type="checkbox"
              checked={values[key]}
              onChange={(e) => onToggle(key, e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          backgroundColor: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '10px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
          padding: '20px 22px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: `${theme.fontSizes[3]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
            }}
          >
            Dev Workspace Configuration
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleCopyEnabled}
              title="Copy enabled items as a shareable list"
              style={{
                background: copied
                  ? theme.colors.success
                  : theme.colors.backgroundTertiary,
                border: `1px solid ${
                  copied ? theme.colors.success : theme.colors.border
                }`,
                color: copied
                  ? theme.colors.background
                  : theme.colors.textSecondary,
                cursor: 'pointer',
                padding: '4px 10px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                fontWeight: theme.fontWeights.medium,
                transition: 'all 0.2s',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy enabled'}</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: `${theme.fontSizes[1]}px`,
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.body,
          }}
        >
          Choose what shows by default in every dev workspace window. Changes
          save automatically.
        </p>

        {(repositoryPath || onOpenInFinder) && (
          <div style={{ marginBottom: '20px' }}>
            <h3
              style={{
                fontSize: `${theme.fontSizes[2]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
                margin: '0 0 10px 0',
              }}
            >
              Repository actions
            </h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {repositoryPath && (
                <button
                  onClick={handleCopyPath}
                  title={pathCopied ? 'Copied!' : `Copy path: ${repositoryPath}`}
                  style={{
                    background: pathCopied
                      ? theme.colors.success
                      : theme.colors.backgroundTertiary,
                    border: `1px solid ${
                      pathCopied ? theme.colors.success : theme.colors.border
                    }`,
                    color: pathCopied
                      ? theme.colors.background
                      : theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontFamily: theme.fonts.body,
                    fontWeight: theme.fontWeights.medium,
                    transition: 'all 0.2s',
                  }}
                >
                  {pathCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{pathCopied ? 'Copied' : 'Copy path'}</span>
                </button>
              )}
              {onOpenInFinder && (
                <button
                  onClick={onOpenInFinder}
                  title="Open in Finder"
                  style={{
                    background: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    color: theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontFamily: theme.fonts.body,
                    fontWeight: theme.fontWeights.medium,
                    transition: 'all 0.2s',
                  }}
                >
                  <FolderOpen size={14} />
                  <span>Open in Finder</span>
                </button>
              )}
            </div>
          </div>
        )}

        {renderSection(
          'Titlebar buttons',
          TITLEBAR_BUTTON_LABELS,
          draft.titlebar,
          (key, value) =>
            update({
              ...draft,
              titlebar: { ...draft.titlebar, [key]: value },
            }),
        )}

        {renderSection(
          'Left sidebar icons',
          LEFT_ICON_LABELS,
          draft.leftSidebarIcons,
          (key, value) =>
            update({
              ...draft,
              leftSidebarIcons: {
                ...draft.leftSidebarIcons,
                [key]: value,
              },
            }),
        )}

        {renderSection(
          'Right sidebar icons',
          RIGHT_ICON_LABELS,
          draft.rightSidebarIcons,
          (key, value) =>
            update({
              ...draft,
              rightSidebarIcons: {
                ...draft.rightSidebarIcons,
                [key]: value,
              },
            }),
        )}
      </div>
    </div>
  );
};

export const DEFAULT_DEV_WORKSPACE_CONFIG: DevWorkspaceConfig = {
  titlebar: {
    fileCity3D: false,
    trail: false,
    traces: false,
    sync: false,
    focus: true,
    notes: false,
    gitConfig: true,
    storybook: true,
  },
  leftSidebarIcons: {
    files: true,
    terminalSessions: false,
    packageComposition: false,
    docs: true,
    agentsList: true,
    trails: true,
  },
  rightSidebarIcons: {
    fileCity: true,
    codeQuality: false,
    kanban: false,
    bruno: false,
  },
};

export function mergeDevWorkspaceConfig(
  prefs: UserPreferences['devWorkspace'],
): DevWorkspaceConfig {
  return {
    titlebar: {
      ...DEFAULT_DEV_WORKSPACE_CONFIG.titlebar,
      ...(prefs?.titlebar ?? {}),
    },
    leftSidebarIcons: {
      ...DEFAULT_DEV_WORKSPACE_CONFIG.leftSidebarIcons,
      ...(prefs?.leftSidebarIcons ?? {}),
    },
    rightSidebarIcons: {
      ...DEFAULT_DEV_WORKSPACE_CONFIG.rightSidebarIcons,
      ...(prefs?.rightSidebarIcons ?? {}),
    },
  };
}

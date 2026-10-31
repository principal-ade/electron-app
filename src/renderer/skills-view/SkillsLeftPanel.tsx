/**
 * SkillsLeftPanel
 *
 * The Skills surface's swappable left-panel slot in `WorkspaceShell` — the
 * launcher list. A My Skills / Browse switch sits under the header: My Skills
 * lists skills installed in the detected agent directories; Browse takes a
 * GitHub repo (or a recently browsed one) and lists the skills it contains.
 * Selecting a row emits `skill:selected` on the provider bus, which
 * `SkillsSurfaceProvider` turns into the detail tab.
 *
 * All state comes from `useSkillsSurface`; the skill lists themselves come from
 * the agent-panels data hooks. Layout mirrors the other left panels
 * (Drawings, Topics, Requests): 40px header, 30px filter bar, flat rows.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Check,
  FolderPlus,
  Github,
  RefreshCw,
  Search,
  ToolCase,
  X,
} from 'lucide-react';
import { SegmentedControl } from '../components/SegmentedControl';
import { OrgSectionHeaderCard } from '../panels/cards/OrgSectionHeaderCard';
import { SkillLockService } from '../main-process-api/SkillLockService';
import type { SkillLockEntry } from '../../shared/main-process-api-interfaces/SkillLockAPI';
import {
  useSkillsData,
  type Skill,
} from '../panels/agent-panels/skills/hooks/useSkillsData';
import { useSkillsBrowseData } from '../panels/agent-panels/skills/hooks/useSkillsBrowseData';
import { SkillsRepoOnboarding } from '../principal-window/views/SkillBrowserView/SkillsRepoOnboarding';
import { useWorkspaceTabs } from '../principal-window/PortalTabsContext';
import { useDelayedLoading } from '../hooks/useDelayedLoading';
import { skillContextDragText } from '../utils/agentContextDragText';
import {
  useSkillsSurface,
  type RecentRepo,
  type SkillsSurfaceValue,
} from './SkillsSurfaceContext';

type Theme = ReturnType<typeof useTheme>['theme'];

function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function sourceLabel(skill: Skill): string {
  const sources = new Set(
    (skill.installedLocations?.length
      ? skill.installedLocations.map((loc) => loc.source)
      : [skill.source]
    ).map((source) => (source.endsWith('-claude') ? 'Claude' : 'Global')),
  );
  return [...sources].join(' · ');
}

/** Lock file entries are keyed by the skill's folder name. */
function skillFolderName(skill: Skill): string {
  const parts = (skill.skillFolderPath || skill.path)
    .split('/')
    .filter(Boolean);
  return parts[parts.length - 1] || skill.name;
}

interface SkillGroup {
  key: string;
  label: string;
  /** GitHub owner, for the avatar. Absent for non-GitHub or untracked skills. */
  login?: string;
  /** URL to browse this group's source repo; absent for the Local group. */
  browseUrl?: string;
  skills: Skill[];
}

const LOCAL_GROUP_KEY = 'local';

/** Group installed skills by the source repo they were installed from. */
function groupBySource(
  skills: Skill[],
  lock: Record<string, SkillLockEntry>,
): SkillGroup[] {
  const groups = new Map<string, SkillGroup>();
  for (const skill of skills) {
    const entry = lock[skillFolderName(skill)];
    let key = LOCAL_GROUP_KEY;
    let label = 'Local';
    let login: string | undefined;
    let browseUrl: string | undefined;
    if (entry?.source) {
      key = entry.source;
      label = entry.source;
      if (entry.sourceType === 'github') {
        login = entry.source.split('/')[0];
        browseUrl = entry.branch
          ? `https://github.com/${entry.source}/tree/${entry.branch}`
          : entry.sourceUrl || `https://github.com/${entry.source}`;
      }
    }
    const group = groups.get(key) ?? {
      key,
      label,
      login,
      browseUrl,
      skills: [],
    };
    group.skills.push(skill);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === LOCAL_GROUP_KEY) return 1;
    if (b.key === LOCAL_GROUP_KEY) return -1;
    return a.label.localeCompare(b.label);
  });
}

function matchesQuery(skill: Skill, query: string): boolean {
  if (!query) return true;
  return (
    skill.name.toLowerCase().includes(query) ||
    (skill.description ?? '').toLowerCase().includes(query) ||
    (skill.capabilities ?? []).some((cap) => cap.toLowerCase().includes(query))
  );
}

const useSpacing = (theme: Theme) => ({
  xs: theme.space?.[1] || 4,
  sm: theme.space?.[2] || 8,
});

const iconButtonStyle = (theme: Theme, spacing: { xs: number }) =>
  ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    background: 'transparent',
    border: 'none',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
  }) satisfies React.CSSProperties;

const EmptyState: React.FC<{ text: string }> = ({ text }) => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  return (
    <div
      style={{
        padding: `${spacing.sm * 3}px ${spacing.sm * 2}px`,
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
};

/** A 30px search field matching the other left panels' filter bars. */
const FilterBar: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        height: 30,
        boxSizing: 'border-box',
        padding: `0 ${spacing.sm}px`,
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary,
        flexShrink: 0,
      }}
    >
      <Search size={14} color={theme.colors.textSecondary} />
      <input
        type="text"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Clear filter"
          aria-label="Clear filter"
          style={{ ...iconButtonStyle(theme, spacing), padding: 0 }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

interface SkillRowProps {
  skill: Skill;
  active: boolean;
  /** Right-hand monospace tag (source, or install state in Browse). */
  tag?: React.ReactNode;
  draggable?: boolean;
  onClick: () => void;
}

const SkillRow: React.FC<SkillRowProps> = ({
  skill,
  active,
  tag,
  draggable,
  onClick,
}) => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={
        draggable
          ? (event) => {
              if (!event.dataTransfer) return;
              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData(
                'text/plain',
                skillContextDragText(skill.path, skill.name),
              );
            }
          : undefined
      }
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing.sm,
        width: '100%',
        padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
        backgroundColor:
          active || hovered ? theme.colors.backgroundSecondary : 'transparent',
        border: 'none',
        borderBottom: `1px solid ${theme.colors.border}`,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.15s ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[2],
            fontWeight: active ? 700 : 500,
            color: theme.colors.text,
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {skill.name}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: spacing.sm,
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textMuted,
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {skill.description || skill.skillFolderPath}
          </span>
          {tag && (
            <span
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {tag}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const InstalledSkillRows: React.FC<{
  s: SkillsSurfaceValue;
  query: string;
}> = ({ s, query }) => {
  const { activeTabId } = useWorkspaceTabs();
  const { skills, isLoading, error } = useSkillsData({ context: s.context });
  const showLoading = useDelayedLoading(isLoading);
  const [lock, setLock] = useState<Record<string, SkillLockEntry>>({});

  const loadLock = useCallback(async () => {
    try {
      const file = await SkillLockService.getLockFile();
      setLock(file?.skills ?? {});
    } catch (err) {
      console.error('[SkillsLeftPanel] Failed to read skill lock:', err);
    }
  }, []);

  useEffect(() => {
    void loadLock();
    const offInstalled = s.events.on('skill:installed', () => void loadLock());
    const offUninstalled = s.events.on(
      'skill:uninstalled',
      () => void loadLock(),
    );
    return () => {
      offInstalled();
      offUninstalled();
    };
  }, [s.events, loadLock]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((skill) => {
      const locations = skill.installedLocations?.length
        ? skill.installedLocations.map((loc) => loc.source)
        : [skill.source];
      return (
        locations.some((src) => src.startsWith('global-')) &&
        matchesQuery(skill, q)
      );
    });
  }, [skills, query]);

  const groups = useMemo(() => groupBySource(visible, lock), [visible, lock]);

  if (isLoading && skills.length === 0) {
    return showLoading ? <EmptyState text="Loading…" /> : null;
  }
  if (error) return <EmptyState text={error} />;
  if (s.detectedDirectories.length === 0) {
    return (
      <EmptyState text="No agent skill directories found. Use the folder button above to set one up." />
    );
  }
  if (skills.length === 0) {
    return (
      <EmptyState text="No skills installed yet. Use Browse to find some." />
    );
  }
  if (visible.length === 0) {
    return <EmptyState text="No skills match this filter." />;
  }

  const browseSource = (url: string) => {
    s.setViewMode('browse');
    s.setGithubUrl(url);
    void s.handleFetchSkills(url);
  };

  return (
    <>
      {groups.map((group) => {
        return (
          <React.Fragment key={group.key}>
            <OrgSectionHeaderCard
              flush
              header={{
                orgName: group.label,
                login: group.login,
                isUntracked: !group.login,
                repoCount: group.skills.length,
              }}
              onOpen={
                group.browseUrl
                  ? () => browseSource(group.browseUrl as string)
                  : undefined
              }
            />
            {group.skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                draggable
                active={
                  activeTabId === 'skill-detail' &&
                  s.selectedSkill?.id === skill.id
                }
                tag={sourceLabel(skill)}
                onClick={() =>
                  s.events.emit({
                    type: 'skill:selected',
                    source: 'skills-left-panel',
                    timestamp: Date.now(),
                    payload: { skillId: skill.id, skill },
                  })
                }
              />
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
};

const BrowseSkillRows: React.FC<{ s: SkillsSurfaceValue; query: string }> = ({
  s,
  query,
}) => {
  const { theme } = useTheme();
  const { activeTabId } = useWorkspaceTabs();
  const { skills, isLoading, error } = useSkillsBrowseData({
    context: s.context,
  });
  const showLoading = useDelayedLoading(isLoading || s.isLoading);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((skill) => matchesQuery(skill, q));
  }, [skills, query]);

  if ((isLoading || s.isLoading) && skills.length === 0) {
    return showLoading ? <EmptyState text="Loading…" /> : null;
  }
  if (error) return <EmptyState text={error} />;
  if (skills.length === 0) {
    return <EmptyState text="No skills found in this repository." />;
  }
  if (visible.length === 0) {
    return <EmptyState text="No skills match this filter." />;
  }

  return (
    <>
      {visible.map((skill) => {
        const installed = s.isSkillInstalled(skill);
        return (
          <SkillRow
            key={skill.id}
            skill={skill}
            active={
              activeTabId === 'skill-detail' && s.selectedSkill?.id === skill.id
            }
            tag={
              installed ? (
                <>
                  <Check size={12} color={theme.colors.success} />
                  Installed
                </>
              ) : undefined
            }
            onClick={() =>
              s.events.emit({
                type: 'skill:selected',
                source: 'skills-left-panel',
                timestamp: Date.now(),
                payload: { skillId: skill.id, skill },
              })
            }
          />
        );
      })}
    </>
  );
};

/** Browse mode's top bar: a repo input, or the loaded repo with a clear button. */
/** Owner avatar in the same rounded-square style as the section headers. */
const OwnerAvatar: React.FC<{ login: string }> = ({ login }) => {
  const { theme } = useTheme();
  const [broken, setBroken] = useState(false);
  return (
    <div
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: 6,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.backgroundTertiary,
      }}
    >
      {broken ? (
        <Github size={13} color={theme.colors.textSecondary} />
      ) : (
        <img
          src={`https://github.com/${login}.png?size=48`}
          alt={login}
          width={22}
          height={22}
          style={{ objectFit: 'cover', display: 'block' }}
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
};

const RepoBar: React.FC<{ s: SkillsSurfaceValue }> = ({ s }) => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  const [value, setValue] = useState(s.githubUrl);
  const repo = s.githubRepoInfo;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || s.isLoading) return;
    s.setGithubUrl(trimmed);
    void s.handleFetchSkills(trimmed);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        height: repo ? 44 : 30,
        boxSizing: 'border-box',
        padding: `0 ${spacing.sm}px`,
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary,
        flexShrink: 0,
      }}
    >
      {repo ? (
        <>
          <OwnerAvatar login={repo.owner} />
          <div
            style={{ flex: 1, minWidth: 0 }}
            title={`${repo.owner}/${repo.repo} @ ${repo.branch}`}
          >
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[2],
                fontWeight: 600,
                color: theme.colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {repo.repo}
            </div>
            <div
              style={{
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[1],
                color: theme.colors.textMuted,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {repo.owner}
              {repo.branch !== 'main' && ` @ ${repo.branch}`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              s.clearRepo();
              setValue('');
            }}
            title="Clear repository"
            aria-label="Clear repository"
            style={{ ...iconButtonStyle(theme, spacing), padding: 0 }}
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <>
          <Github size={14} color={theme.colors.textSecondary} />
          <input
            type="text"
            placeholder="owner/repo or GitHub URL"
            aria-label="GitHub repository"
            value={value}
            disabled={s.isLoading}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: theme.colors.text,
              fontFamily: theme.fonts.monospace,
              fontSize: theme.fontSizes[1],
            }}
          />
        </>
      )}
    </div>
  );
};

const RecentRepoRows: React.FC<{
  repos: RecentRepo[];
  onSelect: (repo: RecentRepo) => void;
}> = ({ repos, onSelect }) => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  if (repos.length === 0) {
    return (
      <EmptyState text="Enter a GitHub repository above to browse its skills. Repositories you visit appear here." />
    );
  }

  return (
    <>
      {repos.map((repo) => {
        const key = `${repo.owner}/${repo.repo}`;
        const hovered = hoveredKey === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(repo)}
            onMouseEnter={() => setHoveredKey(key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: spacing.sm,
              width: '100%',
              padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
              backgroundColor: hovered
                ? theme.colors.backgroundSecondary
                : 'transparent',
              border: 'none',
              borderBottom: `1px solid ${theme.colors.border}`,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[2],
                  fontWeight: 500,
                  color: theme.colors.text,
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {key}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: spacing.sm,
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textMuted,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{repo.branch}</span>
                <span style={{ flexShrink: 0 }}>
                  {timeAgo(repo.lastVisited)}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
};

export const SkillsLeftPanel: React.FC = () => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  const s = useSkillsSurface();
  const showLoading = useDelayedLoading(s.checkingConfig);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  if (showLoading) {
    return (
      <div
        style={{
          height: '100%',
          backgroundColor: theme.colors.background,
        }}
      >
        <EmptyState text="Loading…" />
      </div>
    );
  }

  if (s.showOnboarding) {
    return (
      <SkillsRepoOnboarding
        onComplete={s.onOnboardingComplete}
        onCancel={() => s.setShowOnboarding(false)}
      />
    );
  }

  const browsing = s.viewMode === 'browse';
  const repoLoaded = browsing && !!s.browseFileTree;
  const detectedNames = s.detectedDirectories
    .filter((dir) => dir.id !== 'agent-universal')
    .map((dir) => dir.displayName);
  const setupTitle =
    detectedNames.length > 0
      ? `Agent directories: ${detectedNames.join(', ')}`
      : 'Set up agent skill directories';

  const refresh = () => {
    if (browsing) {
      if (s.githubRepoInfo) {
        void s.handleFetchSkills(
          s.githubUrl || `${s.githubRepoInfo.owner}/${s.githubRepoInfo.repo}`,
        );
      }
      return;
    }
    setRefreshing(true);
    s.events.emit({
      type: 'skills:refresh',
      source: 'skills-left-panel',
      timestamp: Date.now(),
      payload: {},
    });
    setTimeout(() => setRefreshing(false), 800);
  };
  const refreshBusy = refreshing || s.isLoading;
  const refreshDisabled = refreshBusy || (browsing && !s.githubRepoInfo);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header: title + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          height: 40,
          boxSizing: 'border-box',
          padding: `0 ${spacing.sm}px`,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <ToolCase
          size={16}
          color={theme.colors.text}
          style={{ marginLeft: 4 }}
        />
        <span
          style={{
            flex: 1,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Skills
        </span>
        <button
          type="button"
          onClick={s.openSetup}
          title={setupTitle}
          aria-label="Set up agent directories"
          style={{
            ...iconButtonStyle(theme, spacing),
            color:
              s.detectedDirectories.length === 0
                ? theme.colors.primary
                : theme.colors.textSecondary,
          }}
        >
          <FolderPlus size={14} />
        </button>
        <button
          type="button"
          onClick={refresh}
          title="Refresh"
          aria-label="Refresh skills"
          disabled={refreshDisabled}
          style={{
            ...iconButtonStyle(theme, spacing),
            cursor: refreshDisabled ? 'default' : 'pointer',
          }}
        >
          <RefreshCw
            size={14}
            style={{
              animation: refreshBusy ? 'spin 0.8s linear infinite' : undefined,
            }}
          />
        </button>
      </div>

      <div style={{ flexShrink: 0 }}>
        <SegmentedControl
          flush
          verticalPadding={8}
          options={[
            { value: 'installed', label: 'My Skills' },
            { value: 'browse', label: 'Browse' },
          ]}
          value={s.viewMode}
          onChange={(value) => {
            setQuery('');
            s.setViewMode(value as typeof s.viewMode);
          }}
          theme={theme}
          variant="pill-flat"
        />
      </div>

      {browsing && <RepoBar s={s} />}

      {(!browsing || repoLoaded) && (
        <FilterBar
          value={query}
          onChange={setQuery}
          placeholder="Filter skills"
        />
      )}

      {s.error && (
        <div
          style={{
            padding: `${spacing.sm}px ${spacing.sm * 2}px`,
            borderBottom: `1px solid ${theme.colors.border}`,
            color: theme.colors.error,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            flexShrink: 0,
          }}
        >
          {s.error}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {!browsing ? (
          <InstalledSkillRows s={s} query={query} />
        ) : repoLoaded ? (
          <BrowseSkillRows s={s} query={query} />
        ) : (
          <RecentRepoRows
            repos={s.recentRepos}
            onSelect={(repo) => void s.handleSelectRecentRepo(repo)}
          />
        )}
      </div>
    </div>
  );
};

export default SkillsLeftPanel;

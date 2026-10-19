import React, { useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { createLocalRepoPurl } from '@principal-ai/alexandria-core-library';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { ArrowDown, ArrowUp, Check, FolderGit2, GitBranch } from 'lucide-react';
import { InProgressActivityPanel } from '../../../panels/InProgressActivityPanel';
import type { InProgressActivityPanelProps } from '../../../panels/InProgressActivityPanel';
import { useHomeRepositoryStatuses } from '../../../panels/home-panel/useHomeRepositoryStatuses';
import { payloadFromLocalEntry } from '../../../events/repositorySelected';
import { PORTAL_INTENTS } from '../../../events/portalIntents';
import { useAuthUser } from '../../../providers/AuthProvider';
import { useGithubOrganizations } from '../../../hooks/useGithubGraph';
import {
  groupSkyRepositories,
  skyRepositoryOwner,
} from './skyRepositoryGroups';

function OwnerAvatar({
  owner,
  avatarUrl,
}: {
  owner: string;
  avatarUrl?: string;
}) {
  const [broken, setBroken] = useState(false);
  return broken ? (
    <FolderGit2 size={22} style={{ flexShrink: 0 }} />
  ) : (
    <img
      src={avatarUrl ?? `https://github.com/${owner}.png?size=64`}
      alt={`${owner} avatar`}
      title={owner}
      width={28}
      height={28}
      style={{ borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
      onError={() => setBroken(true)}
    />
  );
}

function AllRepositories({
  repositories,
  events,
}: Pick<InProgressActivityPanelProps, 'repositories' | 'events'>) {
  const { theme } = useTheme();
  const { user, profile } = useAuthUser();
  const { orgs } = useGithubOrganizations();
  const paths = useMemo(
    () =>
      repositories.filter((repo) => repo.path).map((repo) => String(repo.path)),
    [repositories],
  );
  const statuses = useHomeRepositoryStatuses(paths);
  const groups = useMemo(
    () =>
      groupSkyRepositories(repositories, {
        selfLogin: user?.login ?? null,
        selfName: profile?.name,
        selfAvatarUrl: user?.avatarUrl,
        orgs: user ? orgs : [],
      }),
    [repositories, user, profile, orgs],
  );

  const openRepository = (entry: AlexandriaEntry) => {
    let payload;
    try {
      payload = payloadFromLocalEntry(entry);
    } catch {
      if (!entry.path) return;
      payload = payloadFromLocalEntry({
        ...entry,
        purl: createLocalRepoPurl(String(entry.path)),
      });
    }
    events.emit({
      type: PORTAL_INTENTS.repositorySelected,
      source: 'sky-repositories',
      timestamp: Date.now(),
      payload,
    });
  };

  if (groups.length === 0) {
    return (
      <p style={{ padding: 16, color: theme.colors.textSecondary }}>
        No repositories registered yet.
      </p>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
      <div
        role="region"
        aria-label="All repositories"
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h3
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '0 0 12px',
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
              }}
            >
              {group.owner && (
                <OwnerAvatar
                  key={group.owner}
                  owner={group.owner}
                  avatarUrl={group.avatarUrl}
                />
              )}
              {group.label}
              <span
                style={{ color: theme.colors.textSecondary, fontWeight: 400 }}
              >
                {group.repositories.length}
              </span>
            </h3>
            <div
              role="list"
              aria-label={`${group.label} repositories`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 16,
              }}
            >
              {group.repositories.map((entry) => {
                const path = entry.path ? String(entry.path) : undefined;
                const owner = skyRepositoryOwner(entry);
                const status = path ? statuses.get(path) : undefined;
                const name = entry.github?.name ?? entry.name;
                const synced = Boolean(
                  status?.branch &&
                  (entry.remoteUrl || entry.github || owner) &&
                  status.ahead === 0 &&
                  status.behind === 0,
                );
                const availabilityLabel = !path
                  ? 'Not cloned'
                  : !status
                    ? 'Status pending'
                    : null;
                return (
                  <div
                    key={path ?? entry.purl ?? entry.remoteUrl ?? entry.name}
                    role="listitem"
                  >
                    <button
                      type="button"
                      aria-label={`Open ${name}`}
                      onClick={() => openRepository(entry)}
                      title={path}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        width: '100%',
                        height: '100%',
                        padding: 16,
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: theme.colors.text,
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 8,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                        }}
                      >
                        {!group.owner && owner ? (
                          <OwnerAvatar key={owner} owner={owner} />
                        ) : (
                          <FolderGit2 size={18} style={{ flexShrink: 0 }} />
                        )}
                        <strong
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {name}
                        </strong>
                      </span>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        {availabilityLabel && (
                          <span style={{ color: theme.colors.textSecondary }}>
                            {availabilityLabel}
                          </span>
                        )}
                        {status?.branch && (
                          <span
                            title={
                              synced
                                ? 'No commits ahead of or behind the last known upstream state.'
                                : undefined
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: synced
                                ? theme.colors.success
                                : theme.colors.textSecondary,
                            }}
                          >
                            <GitBranch size={12} />
                            {status.branch}
                            {status.isDirty && (
                              <span style={{ color: theme.colors.warning }}>
                                Dirty
                              </span>
                            )}
                            {synced && (
                              <>
                                <Check size={12} />
                                <span>Synced</span>
                              </>
                            )}
                          </span>
                        )}
                        {status && status.ahead > 0 && (
                          <span
                            aria-label={`${status.ahead} ${status.ahead === 1 ? 'commit' : 'commits'} ahead`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <ArrowUp size={12} />
                            {status.ahead}
                          </span>
                        )}
                        {status && status.behind > 0 && (
                          <span
                            aria-label={`${status.behind} ${status.behind === 1 ? 'commit' : 'commits'} behind`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <ArrowDown size={12} />
                            {status.behind}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const FILTER_STORAGE_KEY = 'principal:skyRepositoryFilter';
type RepositoryFilter = 'in-progress' | 'all';

export function SkyRepositoriesPanel({
  headingStyle,
  ...props
}: InProgressActivityPanelProps & { headingStyle?: React.CSSProperties }) {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<RepositoryFilter>(() => {
    try {
      return localStorage.getItem(FILTER_STORAGE_KEY) === 'all'
        ? 'all'
        : 'in-progress';
    } catch {
      return 'in-progress';
    }
  });
  const selectFilter = (value: RepositoryFilter) => {
    setFilter(value);
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, value);
    } catch {
      // Keep the toggle usable when storage is unavailable.
    }
  };
  return (
    <>
      <div
        role="group"
        aria-label="Repository filter"
        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
      >
        {(['in-progress', 'all'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => selectFilter(value)}
            style={{
              ...headingStyle,
              border: 'none',
              borderBottom: `2px solid ${filter === value ? theme.colors.primary : 'transparent'}`,
              padding: '4px 0',
              background: 'transparent',
              color:
                filter === value
                  ? theme.colors.text
                  : theme.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            {value === 'in-progress' ? 'In Progress' : 'All'}
          </button>
        ))}
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
        {filter === 'in-progress' ? (
          <InProgressActivityPanel {...props} />
        ) : (
          <AllRepositories
            repositories={props.repositories}
            events={props.events}
          />
        )}
      </div>
    </>
  );
}

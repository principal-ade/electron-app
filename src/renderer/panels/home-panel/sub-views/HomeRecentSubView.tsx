/**
 * HomeRecentSubView
 *
 * The "Recently Visited" sub-view: recent projects (from localStorage).
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { History } from 'lucide-react';
import { SubViewHeader } from './SubViewHeader';

interface RecentProject {
  full_name: string;
  name: string;
  owner: { login: string; avatar_url?: string };
}

export interface HomeRecentSubViewProps {
  onBack: () => void;
}

export const HomeRecentSubView: React.FC<HomeRecentSubViewProps> = ({
  onBack,
}) => {
  const { theme } = useTheme();
  const [projects, setProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent-repositories');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setProjects(parsed.slice(0, 20));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <>
      <SubViewHeader
        icon={<History size={14} />}
        label="Recently Visited"
        count={projects.length || undefined}
        onBack={onBack}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {projects.length === 0 ? (
          <ListMessage>
            No recent activity yet. Projects you open will appear here.
          </ListMessage>
        ) : (
          <div>
            <div
              style={{
                padding: '6px 16px',
                fontSize: theme.fontSizes[0],
                fontWeight: 600,
                color: theme.colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: `1px solid ${theme.colors.border}`,
                background: theme.colors.backgroundSecondary,
              }}
            >
              Projects · {projects.length}
            </div>
            {projects.map((project) => (
              <RecentProjectRow key={project.full_name} project={project} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

function RecentProjectRow({ project }: { project: RecentProject }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {project.owner?.avatar_url && (
        <img
          src={project.owner.avatar_url}
          alt=""
          width={16}
          height={16}
          style={{ borderRadius: 4, flexShrink: 0 }}
        />
      )}
      <span
        style={{
          fontSize: theme.fontSizes[1],
          fontWeight: 600,
          color: theme.colors.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {project.full_name}
      </span>
    </div>
  );
}

function ListMessage({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '24px 16px',
        color: theme.colors.textMuted,
        fontSize: theme.fontSizes[1],
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

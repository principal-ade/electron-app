import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2 } from 'lucide-react';
import { parsePurl } from '@principal-ai/alexandria-core-library';
import { TopicService } from '../../main-process-api/TopicService';
import {
  ProjectRepoCard,
  type ProjectRepoCardData,
} from '../../panels/cards/ProjectRepoCard';

interface ProjectEntry {
  purl: string;
  data: ProjectRepoCardData;
}

function projectFromPurl(purl: string): ProjectEntry | null {
  const parsed = parsePurl(purl);
  if (!parsed) return null;
  if (parsed.namespace && parsed.namespace !== 'local') {
    return {
      purl,
      data: { repoName: parsed.name, ownerLogin: parsed.namespace },
    };
  }
  const segments = parsed.name.split('-').filter(Boolean);
  return {
    purl,
    data: { repoName: segments[segments.length - 1] || parsed.name },
  };
}

export interface TopicProjectsRailProps {
  topicId: string;
  onOpenProject?: (purl: string) => void;
  width?: number;
}

/** Displays the repositories declared by a topic. */
export const TopicProjectsRail: React.FC<TopicProjectsRailProps> = ({
  topicId,
  onOpenProject,
  width = 280,
}) => {
  const { theme } = useTheme();
  const [projects, setProjects] = React.useState<ProjectEntry[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const topic = await TopicService.getTopic(topicId);
        if (cancelled) return;
        setProjects(
          (topic?.repos ?? [])
            .map(projectFromPurl)
            .filter((project): project is ProjectEntry => project !== null),
        );
      } catch (err) {
        console.error('[TopicProjectsRail] failed to load projects', err);
        if (!cancelled) setProjects([]);
      }
    };
    void load();
    const off = TopicService.onTopicChange((event) => {
      if ((event.topic?.id ?? event.id) === topicId) void load();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [topicId]);

  const handleProjectClick = React.useCallback(
    (purl: string) => {
      if (onOpenProject) {
        onOpenProject(purl);
        return;
      }
      void navigator.clipboard.writeText(purl).catch(() => {});
    },
    [onOpenProject],
  );

  if (projects.length === 0) return null;

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          color: theme.colors.textSecondary,
        }}
      >
        <FolderGit2 size={14} />
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Projects ({projects.length})
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 8,
        }}
      >
        {projects.map((project) => (
          <ProjectRepoCard
            key={project.purl}
            repo={project.data}
            dense
            onClick={() => handleProjectClick(project.purl)}
          />
        ))}
      </div>
    </aside>
  );
};

export default TopicProjectsRail;

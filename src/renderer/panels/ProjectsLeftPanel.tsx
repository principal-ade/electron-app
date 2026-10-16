/**
 * ProjectsLeftPanel
 *
 * Left panel for the Projects surface. Renders "My Projects" — the user's
 * repositories from the local registry — via {@link ProjectsList}.
 *
 * Two things were intentionally removed:
 * - The user/auth header (avatar, GitHub CLI status, git identity, home
 *   folder). It duplicated the user header already shown on the Home surface
 *   (`HomeLeftPanel` → `UserAboutCard`).
 * - The "My Projects / Team" segmented switch. Team is out of scope for now, so
 *   the panel is My Projects only.
 */

import React from 'react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { ProjectsList, type ProjectFilter } from './ProjectsList';

export interface ProjectsLeftPanelProps {
  /** List of locally registered repositories. */
  repositories: AlexandriaEntry[];
  /** Event bus for panel communication. */
  events: PanelEventEmitter;
  /** Selected filter — owned by the shell so it survives side-panel switches. */
  filter: ProjectFilter;
  onFilterChange: (filter: ProjectFilter) => void;
}

export const ProjectsLeftPanel: React.FC<ProjectsLeftPanelProps> = ({
  repositories,
  events,
  filter,
  onFilterChange,
}) => {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ProjectsList
        repositories={repositories}
        events={events}
        filter={filter}
        onFilterChange={onFilterChange}
      />
    </div>
  );
};

export default ProjectsLeftPanel;

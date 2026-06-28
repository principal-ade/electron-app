/**
 * PrincipalPortal
 *
 * The persistent base layer of the principal window: the swappable
 * left-panel + tabbed-terminal workspace surfaces (Projects / Inbox / Topics /
 * Trails). It is mounted *underneath* the standalone views (Home, Settings,
 * Monitor, …), which `IntegratedShell` renders as overlays on top of it.
 *
 * Because the portal stays mounted while an overlay is up, switching to Home
 * and back is a pure visibility flip — open tabs, terminals, and scroll state
 * survive with no hoisting required.
 *
 * Every workspace surface — Projects, Inbox, Topics, Drawings, and Trails — is
 * now one persistent `WorkspaceShell`: a single tabbed-terminal host (one
 * `terminal:workspace` scope, one `useWorkspaceTabs()` bucket) whose left panel
 * swaps by `activeView`. Switching between them keeps the shell — and its open
 * tabs + terminal — mounted, so e.g. a drawing or trail tab persists while you
 * move between surfaces (Increment 3 + the Drawings/Trails fast-follows; see
 * docs/portal-unification.md).
 */
import React from 'react';
import { WorkspaceShell } from '../../../workspace-shell/WorkspaceShell';

/** The workspace surfaces hosted by the portal (vs. standalone overlays). */
export type WorkspaceView =
  | 'projects'
  | 'inbox'
  | 'topics'
  | 'drawings'
  | 'trails';

export const WORKSPACE_VIEWS: WorkspaceView[] = [
  'projects',
  'inbox',
  'topics',
  'drawings',
  'trails',
];

/** Type guard: is this navigation view a portal-hosted workspace surface? */
export const isWorkspaceView = (view: string): view is WorkspaceView =>
  (WORKSPACE_VIEWS as string[]).includes(view);

export interface PrincipalPortalProps {
  /** Which workspace surface to show in the portal. */
  workspaceView: WorkspaceView;
}

export const PrincipalPortal: React.FC<PrincipalPortalProps> = ({
  workspaceView,
}) => {
  return (
    // `isolation: isolate` keeps each workspace surface's internal z-indexes
    // contained to this base layer, so they can't bleed above the standalone
    // overlay (zIndex 2) and hide views like Settings.
    <div style={{ height: '100%', width: '100%', isolation: 'isolate' }}>
      {(workspaceView === 'projects' ||
        workspaceView === 'inbox' ||
        workspaceView === 'topics' ||
        workspaceView === 'drawings' ||
        workspaceView === 'trails') && (
        <WorkspaceShell activeView={workspaceView} />
      )}
    </div>
  );
};

export default PrincipalPortal;

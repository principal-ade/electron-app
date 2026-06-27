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
 * INCREMENT 3: Projects + Inbox + Topics are now one persistent `WorkspaceShell`
 * — a single tabbed-terminal host (one `terminal:workspace` scope, one
 * `useWorkspaceTabs()` bucket) whose left panel swaps by `activeView`. Switching
 * between the three keeps the shell — and its open tabs + terminal — mounted.
 * Trails is still its own view until Increment 4 folds it in too (see
 * docs/portal-unification.md).
 */
import React from 'react';
import { TrailsView } from '../../views/TrailsView';
import { WorkspaceShell } from '../../../workspace-shell/WorkspaceShell';

/** The workspace surfaces hosted by the portal (vs. standalone overlays). */
export type WorkspaceView = 'projects' | 'inbox' | 'topics' | 'trails';

export const WORKSPACE_VIEWS: WorkspaceView[] = [
  'projects',
  'inbox',
  'topics',
  'trails',
];

/** Type guard: is this navigation view a portal-hosted workspace surface? */
export const isWorkspaceView = (view: string): view is WorkspaceView =>
  (WORKSPACE_VIEWS as string[]).includes(view);

export interface PrincipalPortalProps {
  /** Which workspace surface to show in the portal. */
  workspaceView: WorkspaceView;
  /** Trail id this window booted with / was routed to (forwarded to Trails). */
  bootstrapTrailId: string | null;
  /** Repo path a HomeView card asked Trails to pre-select on mount. */
  bootstrapProjectPath: string | null;
  /** Called once Trails has consumed `bootstrapProjectPath`. */
  onBootstrapProjectPathConsumed: () => void;
}

export const PrincipalPortal: React.FC<PrincipalPortalProps> = ({
  workspaceView,
  bootstrapTrailId,
  bootstrapProjectPath,
  onBootstrapProjectPathConsumed,
}) => {
  return (
    // `isolation: isolate` keeps each workspace surface's internal z-indexes
    // (e.g. TrailsView's full-bleed landing/recent overlays at zIndex 10)
    // contained to this base layer, so they can't bleed above the standalone
    // overlay (zIndex 2) and hide views like Settings.
    <div style={{ height: '100%', width: '100%', isolation: 'isolate' }}>
      {(workspaceView === 'projects' ||
        workspaceView === 'inbox' ||
        workspaceView === 'topics') && (
        <WorkspaceShell activeView={workspaceView} />
      )}
      {workspaceView === 'trails' && (
        <TrailsView
          bootstrapTrailId={bootstrapTrailId}
          bootstrapProjectPath={bootstrapProjectPath}
          onBootstrapProjectPathConsumed={onBootstrapProjectPathConsumed}
        />
      )}
    </div>
  );
};

export default PrincipalPortal;

import React from 'react';

/**
 * Alexandria Workspace Manager
 *
 * This window provides a dedicated interface for managing workspaces,
 * which are cross-repository collections that help organize projects.
 *
 * Features to implement:
 * - List all workspaces
 * - Create/edit/delete workspaces
 * - View workspace members (repositories)
 * - Add/remove repositories from workspaces
 * - Set default workspace
 * - Configure workspace settings (colors, icons, suggested clone paths)
 */
export const AlexandriaWorkspaceApp: React.FC = () => {
  return (
    <div className="flex h-screen flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800 p-4">
        <h1 className="text-2xl font-bold">Alexandria Workspace Manager</h1>
        <p className="text-sm text-gray-400">
          Organize your repositories into logical workspaces
        </p>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Workspace List */}
        <div className="w-64 border-r border-gray-700 bg-gray-800 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Workspaces</h2>
            <button
              className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-700"
              onClick={() => {
                // TODO: Open create workspace modal
                console.log('Create workspace');
              }}
            >
              New
            </button>
          </div>

          <div className="text-sm text-gray-400">
            {/* TODO: Implement workspace list */}
            <p>No workspaces yet.</p>
            <p className="mt-2">Click "New" to create your first workspace.</p>
          </div>
        </div>

        {/* Main Panel - Workspace Details */}
        <div className="flex flex-1 flex-col p-6">
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <h2 className="mb-4 text-xl font-semibold">Getting Started</h2>

            <div className="space-y-4 text-gray-300">
              <p>
                Workspaces are cross-repository collections that help you organize
                related projects together.
              </p>

              <div className="rounded bg-gray-900 p-4">
                <h3 className="mb-2 font-semibold text-blue-400">
                  Key Features:
                </h3>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>Group multiple repositories into logical workspaces</li>
                  <li>All local clones of the same repo share workspace membership</li>
                  <li>Set suggested clone paths for workspace repositories</li>
                  <li>Customize with colors and icons</li>
                  <li>Set a default workspace for new repositories</li>
                </ul>
              </div>

              <div className="rounded border border-yellow-700 bg-yellow-900/20 p-4">
                <h3 className="mb-2 font-semibold text-yellow-400">
                  Implementation Status:
                </h3>
                <p className="text-sm">
                  This is a new window scaffold. The backend workspace functionality
                  is fully implemented. UI components need to be built using the
                  WorkspaceService API.
                </p>
              </div>

              <div className="rounded bg-gray-900 p-4">
                <h3 className="mb-2 font-semibold text-green-400">
                  Next Steps:
                </h3>
                <ol className="list-inside list-decimal space-y-1 text-sm">
                  <li>Import WorkspaceService from renderer/main-process-api</li>
                  <li>Implement workspace list with create/edit/delete</li>
                  <li>Add workspace details panel showing members</li>
                  <li>Add repository selection for workspace membership</li>
                  <li>Integrate with CreateWorkspaceModal component</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Extension Details Component
 *
 * Displays detailed information about a selected extension
 * and its panels.
 */

import React from 'react';
import type {
  DiscoveredExtension,
  PanelMetadata,
} from '../../../shared/main-process-api-interfaces/ExtensionAPI';

interface ExtensionDetailsProps {
  extension: DiscoveredExtension;
  selectedPanel: PanelMetadata | null;
  onSelectPanel: (panel: PanelMetadata) => void;
  onPreviewPanel: (panel: PanelMetadata) => void;
  onToggleEnabled: () => void;
  onUninstall: () => void;
}

export const ExtensionDetails: React.FC<ExtensionDetailsProps> = ({
  extension,
  selectedPanel,
  onSelectPanel,
  onPreviewPanel,
  onToggleEnabled,
  onUninstall,
}) => {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">
              {extension.packageName}
            </h1>
            <div className="mt-1 text-sm text-gray-400">
              Version {extension.packageVersion}
              {extension.packageAuthor && ` • by ${extension.packageAuthor}`}
            </div>
            {extension.packageDescription && (
              <p className="mt-2 text-sm text-gray-300">
                {extension.packageDescription}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleEnabled}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                extension.enabled
                  ? 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {extension.enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={onUninstall}
              className="px-3 py-1.5 text-sm rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 transition-colors"
            >
              Uninstall
            </button>
          </div>
        </div>

        {/* Status badge */}
        {!extension.enabled && (
          <div className="mt-3 px-3 py-2 bg-yellow-900/20 border border-yellow-700/30 rounded text-yellow-400 text-sm">
            This extension is disabled. Enable it to use its panels.
          </div>
        )}
      </div>

      {/* Panels */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-sm font-medium text-gray-300 mb-4">
          Panels ({extension.panels.length})
        </h2>

        {extension.panels.length === 0 ? (
          <div className="text-gray-500 text-sm">
            This extension doesn't export any panels.
          </div>
        ) : (
          <div className="grid gap-3">
            {extension.panels.map((panel) => (
              <div
                key={panel.id}
                className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                  selectedPanel?.id === panel.id
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                }`}
                onClick={() => onSelectPanel(panel)}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="text-2xl">
                    {panel.icon || '📦'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-200">
                        {panel.name}
                      </span>
                      {panel.version && (
                        <span className="text-xs text-gray-500">
                          v{panel.version}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      {panel.id}
                    </div>

                    {panel.description && (
                      <p className="text-sm text-gray-400 mt-2">
                        {panel.description}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {panel.surfaces && panel.surfaces.length > 0 && (
                        <div className="text-xs text-gray-500">
                          <span className="text-gray-600">Surfaces:</span>{' '}
                          {panel.surfaces.join(', ')}
                        </div>
                      )}
                      {panel.slices && panel.slices.length > 0 && (
                        <div className="text-xs text-gray-500">
                          <span className="text-gray-600">Data:</span>{' '}
                          {panel.slices.join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Preview Button */}
                    {extension.enabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewPanel(panel);
                        }}
                        className="mt-3 px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                      >
                        Preview Panel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with path info */}
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Path:</span>
          <code className="text-gray-400 truncate" title={extension.packagePath}>
            {extension.packagePath}
          </code>
        </div>
        {extension.installedAt && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-600">Installed:</span>
            <span className="text-gray-400">
              {new Date(extension.installedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

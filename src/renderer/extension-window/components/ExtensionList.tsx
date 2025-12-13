/**
 * Extension List Component
 *
 * Displays a list of installed extensions.
 */

import React from 'react';
import type { DiscoveredExtension } from '../../../shared/main-process-api-interfaces/ExtensionAPI';

interface ExtensionListProps {
  extensions: DiscoveredExtension[];
  selectedExtension: DiscoveredExtension | null;
  onSelectExtension: (extension: DiscoveredExtension) => void;
  onToggleEnabled: (extension: DiscoveredExtension) => void;
}

export const ExtensionList: React.FC<ExtensionListProps> = ({
  extensions,
  selectedExtension,
  onSelectExtension,
  onToggleEnabled,
}) => {
  return (
    <div className="divide-y divide-gray-800">
      {extensions.map((extension) => (
        <div
          key={extension.packageName}
          className={`p-3 cursor-pointer transition-colors ${
            selectedExtension?.packageName === extension.packageName
              ? 'bg-gray-700'
              : 'hover:bg-gray-800'
          }`}
          onClick={() => onSelectExtension(extension)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Extension name */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200 truncate">
                  {extension.packageName}
                </span>
                {!extension.enabled && (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-600 text-gray-400 rounded">
                    Disabled
                  </span>
                )}
              </div>

              {/* Version and author */}
              <div className="text-xs text-gray-500 mt-0.5">
                v{extension.packageVersion}
                {extension.packageAuthor && ` • ${extension.packageAuthor}`}
              </div>

              {/* Panel count */}
              <div className="text-xs text-gray-500 mt-1">
                {extension.panels.length} panel
                {extension.panels.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Enable/Disable toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnabled(extension);
              }}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                extension.enabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
              title={extension.enabled ? 'Disable' : 'Enable'}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  extension.enabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

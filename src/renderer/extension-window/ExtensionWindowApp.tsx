/**
 * Extension Window App
 *
 * Main application component for the extension browser window.
 * Lists installed extensions and allows users to enable/disable them.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  DiscoveredExtension,
  PanelMetadata,
} from '../../shared/main-process-api-interfaces/ExtensionAPI';
import type { ExtensionWindowMainProcessAPI } from '../../shared/main-process-api-interfaces/ExtensionWindowAPI';
import { ExtensionWindowTitlebar } from './ExtensionWindowTitlebar';
import { ExtensionList } from './components/ExtensionList';
import { ExtensionDetails } from './components/ExtensionDetails';
import { PanelHarness } from './components/PanelHarness';

// Get the mainProcess API from the window object
const mainProcess = (window as any).mainProcess as
  | ExtensionWindowMainProcessAPI
  | undefined;

// Check if the API is available at module level
const isAPIAvailable = !!mainProcess?.extension;

export const ExtensionWindowApp: React.FC = () => {
  const [extensions, setExtensions] = useState<DiscoveredExtension[]>([]);
  const [selectedExtension, setSelectedExtension] =
    useState<DiscoveredExtension | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<PanelMetadata | null>(
    null,
  );
  const [previewingPanel, setPreviewingPanel] = useState<{
    extension: DiscoveredExtension;
    panel: PanelMetadata;
  } | null>(null);
  const [extensionsDirectory, setExtensionsDirectory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  // Load extensions on mount
  const loadExtensions = useCallback(async () => {
    if (!mainProcess?.extension) return;

    setLoading(true);
    setError(null);

    try {
      const [discoveredExtensions, directory] = await Promise.all([
        mainProcess.extension.discoverExtensions(),
        mainProcess.extension.getExtensionsDirectory(),
      ]);

      setExtensions(discoveredExtensions);
      setExtensionsDirectory(directory);

      // Auto-select first extension if none selected
      if (discoveredExtensions.length > 0 && !selectedExtension) {
        setSelectedExtension(discoveredExtensions[0]);
        if (discoveredExtensions[0].panels.length > 0) {
          setSelectedPanel(discoveredExtensions[0].panels[0]);
        }
      }
    } catch (err) {
      console.error('[ExtensionWindow] Failed to load extensions:', err);
      setError('Failed to load extensions');
    } finally {
      setLoading(false);
    }
  }, [selectedExtension]);

  useEffect(() => {
    if (!mainProcess?.extension) return;

    loadExtensions();

    // Subscribe to extension changes
    const unsubscribe = mainProcess.extension.onExtensionsChanged(
      (updatedExtensions) => {
        setExtensions(updatedExtensions);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [loadExtensions]);

  // Handle extension selection
  const handleSelectExtension = (extension: DiscoveredExtension) => {
    setSelectedExtension(extension);
    if (extension.panels.length > 0) {
      setSelectedPanel(extension.panels[0]);
    } else {
      setSelectedPanel(null);
    }
  };

  // Handle panel selection
  const handleSelectPanel = (panel: PanelMetadata) => {
    setSelectedPanel(panel);
  };

  // Handle panel preview
  const handlePreviewPanel = (panel: PanelMetadata) => {
    if (selectedExtension) {
      setPreviewingPanel({ extension: selectedExtension, panel });
    }
  };

  // Close panel preview
  const handleClosePreview = () => {
    setPreviewingPanel(null);
  };

  // Handle enable/disable
  const handleToggleEnabled = async (extension: DiscoveredExtension) => {
    if (!mainProcess?.extension) return;

    try {
      if (extension.enabled) {
        await mainProcess.extension.disableExtension(extension.packageName);
      } else {
        await mainProcess.extension.enableExtension(extension.packageName);
      }
      await loadExtensions();
    } catch (err) {
      console.error('[ExtensionWindow] Failed to toggle extension:', err);
    }
  };

  // Handle uninstall
  const handleUninstall = async (extension: DiscoveredExtension) => {
    if (!mainProcess?.extension) return;

    if (
      !confirm(`Are you sure you want to uninstall "${extension.packageName}"?`)
    ) {
      return;
    }

    try {
      await mainProcess.extension.uninstallExtension(extension.packageName);
      if (selectedExtension?.packageName === extension.packageName) {
        setSelectedExtension(null);
        setSelectedPanel(null);
      }
      await loadExtensions();
    } catch (err) {
      console.error('[ExtensionWindow] Failed to uninstall extension:', err);
    }
  };

  // Show error state if API is not available
  if (!isAPIAvailable) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-gray-900 flex flex-col items-center justify-center text-white">
        <div className="text-red-500 text-xl mb-4">
          Extension API not available
        </div>
        <div className="text-gray-400 text-sm text-center">
          The preload script may not have loaded correctly.
          <br />
          Check the console for [Preload-ExtensionWindow] logs.
        </div>
        <div className="text-gray-500 text-xs mt-4 text-center">
          mainProcess: {mainProcess ? 'defined' : 'undefined'}
          <br />
          extension: {mainProcess?.extension ? 'defined' : 'undefined'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex flex-col">
      <ExtensionWindowTitlebar
        extensionsDirectory={extensionsDirectory}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Extension List Sidebar */}
        <div
          className={`border-r border-gray-700 flex flex-col transition-all duration-200 ease-in-out overflow-hidden ${
            sidebarCollapsed ? 'w-0 border-r-0' : 'w-80'
          }`}
        >
          <div className="p-4 border-b border-gray-700 min-w-80">
            <h2 className="text-sm font-medium text-gray-300">
              Installed Extensions
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {extensions.length} extension{extensions.length !== 1 ? 's' : ''}{' '}
              found
            </p>
          </div>

          <div className="flex-1 overflow-y-auto min-w-80">
            {loading ? (
              <div className="p-4 text-gray-400 text-sm">
                Loading extensions...
              </div>
            ) : error ? (
              <div className="p-4 text-red-400 text-sm">{error}</div>
            ) : extensions.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">
                <p>No extensions installed.</p>
                <p className="mt-2 text-xs">
                  Extensions are stored in:
                  <br />
                  <code className="text-gray-400">{extensionsDirectory}</code>
                </p>
              </div>
            ) : (
              <ExtensionList
                extensions={extensions}
                selectedExtension={selectedExtension}
                onSelectExtension={handleSelectExtension}
                onToggleEnabled={handleToggleEnabled}
              />
            )}
          </div>
        </div>

        {/* Extension Details or Panel Preview */}
        <div className="flex-1 overflow-hidden">
          {previewingPanel ? (
            <PanelHarness
              packageName={previewingPanel.extension.packageName}
              panel={previewingPanel.panel}
              onClose={handleClosePreview}
            />
          ) : selectedExtension ? (
            <ExtensionDetails
              extension={selectedExtension}
              selectedPanel={selectedPanel}
              onSelectPanel={handleSelectPanel}
              onPreviewPanel={handlePreviewPanel}
              onToggleEnabled={() => handleToggleEnabled(selectedExtension)}
              onUninstall={() => handleUninstall(selectedExtension)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-4">📦</div>
                <p>Select an extension to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Panel Harness Component
 *
 * A container that dynamically loads and renders an extension panel
 * for preview/testing within the extension window.
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import type { PanelMetadata } from '../../../shared/main-process-api-interfaces/ExtensionAPI';
import type { ExtensionWindowMainProcessAPI } from '../../../shared/main-process-api-interfaces/ExtensionWindowAPI';

// Get the mainProcess API from the window object
const mainProcess = (window as any).mainProcess as ExtensionWindowMainProcessAPI | undefined;

interface PanelHarnessProps {
  /** The package name of the extension */
  packageName: string;
  /** The panel metadata to render */
  panel: PanelMetadata;
  /** Callback when user wants to close the harness */
  onClose: () => void;
}

interface LoadedPanel {
  component: React.ComponentType<any>;
  metadata: PanelMetadata;
}

/**
 * Transform ES module imports/exports to use provided globals
 * Converts: import { jsx } from "react/jsx-runtime"
 * To use the React globals we provide
 */
function transformBundleToUseGlobals(code: string): string {
  // Replace react/jsx-runtime imports
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*["']react\/jsx-runtime["'];?/g,
    (_, imports) => {
      const importList = imports.split(',').map((i: string) => i.trim());
      return importList.map((imp: string) => {
        const [name, alias] = imp.split(/\s+as\s+/).map((s: string) => s.trim());
        const varName = alias || name;
        return `const ${varName} = __REACT_JSX_RUNTIME__.${name};`;
      }).join('\n');
    }
  );

  // Replace react imports (default and named)
  code = code.replace(
    /import\s+(\w+)\s*,?\s*\{([^}]*)\}\s*from\s*["']react["'];?/g,
    (_, defaultImport, namedImports) => {
      const lines = [`const ${defaultImport} = __REACT__;`];
      if (namedImports.trim()) {
        const importList = namedImports.split(',').map((i: string) => i.trim()).filter(Boolean);
        importList.forEach((imp: string) => {
          const [name, alias] = imp.split(/\s+as\s+/).map((s: string) => s.trim());
          const varName = alias || name;
          lines.push(`const ${varName} = __REACT__.${name};`);
        });
      }
      return lines.join('\n');
    }
  );

  // Replace simple react default import
  code = code.replace(
    /import\s+(\w+)\s+from\s*["']react["'];?/g,
    (_, defaultImport) => `const ${defaultImport} = __REACT__;`
  );

  // Replace simple react named imports only
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*["']react["'];?/g,
    (_, imports) => {
      const importList = imports.split(',').map((i: string) => i.trim()).filter(Boolean);
      return importList.map((imp: string) => {
        const [name, alias] = imp.split(/\s+as\s+/).map((s: string) => s.trim());
        const varName = alias || name;
        return `const ${varName} = __REACT__.${name};`;
      }).join('\n');
    }
  );

  // Transform ES module exports to assign to exports object
  // Handle: export { foo, bar, baz };
  code = code.replace(
    /export\s*\{([^}]+)\};?/g,
    (_, exports) => {
      const exportList = exports.split(',').map((e: string) => e.trim()).filter(Boolean);
      return exportList.map((exp: string) => {
        // Handle "foo as bar" syntax
        const [name, alias] = exp.split(/\s+as\s+/).map((s: string) => s.trim());
        const exportName = alias || name;
        return `__EXPORTS__.${exportName} = ${name};`;
      }).join('\n');
    }
  );

  // Handle: export const foo = ...;
  code = code.replace(
    /export\s+const\s+(\w+)\s*=/g,
    (_, name) => `const ${name} = __EXPORTS__.${name} =`
  );

  // Handle: export function foo() { ... }
  code = code.replace(
    /export\s+function\s+(\w+)/g,
    (_, name) => `__EXPORTS__.${name} = function ${name}`
  );

  // Handle: export default ...
  code = code.replace(
    /export\s+default\s+/g,
    '__EXPORTS__.default = '
  );

  return code;
}

/**
 * Execute the transformed bundle and extract exports
 */
function executeBundle(code: string): any {
  // Transform the bundle to use globals
  const transformedCode = transformBundleToUseGlobals(code);

  // Create exports object
  const moduleExports: any = {};

  // Wrap in a function that provides the globals
  const wrappedCode = `
    (function(__EXPORTS__, __REACT__, __REACT_JSX_RUNTIME__) {
      ${transformedCode}
    })
  `;

  try {
    // eslint-disable-next-line no-eval
    const fn = eval(wrappedCode);
    fn(moduleExports, React, ReactJSXRuntime);
    return moduleExports;
  } catch (err) {
    console.error('[PanelHarness] Failed to execute bundle:', err);
    console.error('[PanelHarness] Transformed code (first 2000 chars):', transformedCode.substring(0, 2000));
    throw err;
  }
}

export const PanelHarness: React.FC<PanelHarnessProps> = ({
  packageName,
  panel,
  onClose,
}) => {
  const [loadedPanel, setLoadedPanel] = useState<LoadedPanel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPanel = useCallback(async () => {
    if (!mainProcess?.extension) {
      setError('Extension API not available');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch the bundle content from main process
      const bundleContent = await mainProcess.extension.fetchExtensionBundle(packageName);

      if (!bundleContent) {
        setError(`Failed to fetch bundle for: ${packageName}`);
        setLoading(false);
        return;
      }

      // Execute the bundle with React globals injected
      const module = executeBundle(bundleContent);

      if (!Array.isArray(module.panels)) {
        setError('Extension does not export a panels array');
        setLoading(false);
        return;
      }

      // Find the specific panel by ID
      const panelDef = module.panels.find(
        (p: any) => p.metadata?.id === panel.id
      );

      if (!panelDef || !panelDef.component) {
        setError(`Panel not found: ${panel.id}`);
        setLoading(false);
        return;
      }

      setLoadedPanel({
        component: panelDef.component,
        metadata: panelDef.metadata,
      });
    } catch (err) {
      console.error('[PanelHarness] Failed to load panel:', err);
      setError(err instanceof Error ? err.message : 'Failed to load panel');
    } finally {
      setLoading(false);
    }
  }, [packageName, panel.id]);

  useEffect(() => {
    loadPanel();
  }, [loadPanel]);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xl">{panel.icon || '📦'}</span>
          <div>
            <h2 className="text-sm font-medium text-gray-100">{panel.name}</h2>
            <p className="text-xs text-gray-500">{packageName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadPanel}
            className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="Reload panel"
          >
            ↻ Reload
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin text-2xl mb-2">⏳</div>
              <p className="text-gray-400 text-sm">Loading panel...</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <div className="text-3xl mb-3">⚠️</div>
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={loadPanel}
                className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : loadedPanel ? (
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-400 text-sm">Rendering panel...</p>
              </div>
            }
          >
            <PanelRenderer panel={loadedPanel} />
          </Suspense>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-sm">No panel loaded</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Separate component to render the loaded panel with error boundary
 */
const PanelRenderer: React.FC<{ panel: LoadedPanel }> = ({ panel }) => {
  const Component = panel.component;

  // Provide mock context/props that panels might expect
  // This can be extended based on what panels typically need
  const mockProps = {
    // Common panel props
    isActive: true,
    onClose: () => console.log('[PanelHarness] Panel requested close'),
  };

  return (
    <div className="h-full w-full overflow-auto">
      <Component {...mockProps} />
    </div>
  );
};

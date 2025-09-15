import React, { useState } from 'react';
import { RefreshCw, Info } from 'lucide-react';
import { SystemService } from '../../main-process-api/SystemService';

export const UpdateSettings: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [currentVersion] = useState(() => {
    // Get version from package.json or electron app
    return window.electron?.app?.getVersion?.() || '0.0.1';
  });

  const checkForUpdates = async () => {
    setIsChecking(true);
    
    try {
      const result = await SystemService.checkForUpdateManually();
      setLastCheck(new Date());
      
      if (result.error) {
        console.error('Update check failed:', result.error);
      }
      
      if (result.updateAvailable && result.version) {
        console.log('Update available:', result.version);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Application Updates
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Current Version
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  v{currentVersion}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Automatic Updates
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automatically check for updates on startup
              </p>
              {lastCheck && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Last checked: {lastCheck.toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={checkForUpdates}
              disabled={isChecking}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`}
              />
              {isChecking ? 'Checking...' : 'Check Now'}
            </button>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Update Channel
            </h4>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              defaultValue="latest"
            >
              <option value="latest">Stable (Recommended)</option>
              <option value="beta">Beta</option>
              <option value="alpha">Alpha (Unstable)</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Choose which release channel to receive updates from
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              About Auto-Updates
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              When updates are available, you'll be notified and can choose when
              to install them. The app will download updates in the background
              and prompt you to restart when ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

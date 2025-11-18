import React, { useState } from 'react';
import type { CallimachusConfig } from '@a24z/callimachus';
import { CheckCircle, XCircle, Loader2, Server } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';

interface ConnectionPanelProps {
  isConnected: boolean;
  onConnect: (config: CallimachusConfig) => void;
  onDisconnect: () => void;
  error: string | null;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  isConnected,
  onConnect,
  onDisconnect,
  error,
}) => {
  const { theme } = useTheme();
  const [pixeltableUrl, setPixeltableUrl] = useState(
    localStorage.getItem('callimachus-url') || 'http://localhost:8000/api/v1',
  );
  const [apiKey, setApiKey] = useState(
    localStorage.getItem('callimachus-apikey') || '',
  );
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);

    const config: CallimachusConfig = {
      pixeltable: {
        apiUrl: pixeltableUrl,
        apiKey: apiKey || undefined,
        tableName: 'alexandria_layouts',
      },
      cache: {
        enabled: true,
        ttl: 300,
        maxSize: 100,
      },
      embedding: {
        model: 'sentence-transformers/all-MiniLM-L6-v2',
      },
    };

    // Save URL and API key for next time
    localStorage.setItem('callimachus-url', pixeltableUrl);
    if (apiKey) {
      localStorage.setItem('callimachus-apikey', apiKey);
    }

    await onConnect(config);
    setIsConnecting(false);
  };

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: theme.colors.backgroundSecondary,
        borderColor: theme.colors.border,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server size={20} style={{ color: theme.colors.primary }} />
          <span className="font-medium">Pixeltable Connection</span>
        </div>
        {isConnected && (
          <div className="flex items-center gap-1 text-green-500">
            <CheckCircle size={16} />
            <span className="text-sm">Connected</span>
          </div>
        )}
        {!isConnected && !error && (
          <div className="flex items-center gap-1 text-gray-500">
            <XCircle size={16} />
            <span className="text-sm">Disconnected</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-1 text-red-500">
            <XCircle size={16} />
            <span className="text-sm">Error</span>
          </div>
        )}
      </div>

      {!isConnected ? (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="pixeltable-url"
              className="block text-sm font-medium mb-1"
            >
              Pixeltable URL
            </label>
            <input
              id="pixeltable-url"
              type="text"
              value={pixeltableUrl}
              onChange={(e) => setPixeltableUrl(e.target.value)}
              placeholder="http://localhost:8000/api/v1"
              disabled={isConnecting}
              className="w-full px-3 py-2 rounded border"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
            />
          </div>

          <div>
            <label htmlFor="api-key" className="block text-sm font-medium mb-1">
              API Key (optional)
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key if required"
              disabled={isConnecting}
              className="w-full px-3 py-2 rounded border"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
            />
          </div>

          {error && (
            <div className="p-3 rounded bg-red-500/10 text-red-500 text-sm">
              {error}
            </div>
          )}

          <button
            className="w-full px-4 py-2 rounded font-medium transition-colors flex items-center justify-center gap-2"
            onClick={handleConnect}
            disabled={isConnecting || !pixeltableUrl}
            style={{
              backgroundColor:
                isConnecting || !pixeltableUrl
                  ? theme.colors.backgroundSecondary
                  : theme.colors.primary,
              color: theme.colors.background,
              opacity: isConnecting || !pixeltableUrl ? 0.5 : 1,
            }}
          >
            {isConnecting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm opacity-70">Server:</span>
            <span className="text-sm font-mono">{pixeltableUrl}</span>
          </div>
          <button
            className="w-full px-4 py-2 rounded border font-medium transition-colors"
            onClick={onDisconnect}
            style={{
              borderColor: theme.colors.border,
              color: theme.colors.text,
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

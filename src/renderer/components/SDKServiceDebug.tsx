import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { printCallStats } from '../main-process-api/AgentSessionSDKService';

/**
 * Debug component to track SDK service usage
 * Shows which stub methods are being called
 */
export const SDKServiceDebug: React.FC = () => {
  const { theme } = useTheme();

  const handlePrintStats = () => {
    printCallStats();
    console.log('SDK Service call statistics printed to console');
  };

  const handleResetStats = () => {
    // Reset by reloading the window
    if (confirm('Reset SDK service tracking stats? This will reload the window.')) {
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: theme.background2,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        zIndex: 9999,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={16} style={{ color: theme.primary }} />
        <span style={{ color: theme.textSecondary, fontSize: '12px' }}>
          SDK Service Debug
        </span>
      </div>
      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
        <button
          onClick={handlePrintStats}
          style={{
            backgroundColor: theme.primary,
            color: theme.background,
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Print Call Stats
        </button>
        <button
          onClick={handleResetStats}
          style={{
            backgroundColor: theme.background3,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <RefreshCw size={12} />
          Reset
        </button>
      </div>
    </div>
  );
};
import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { RefreshCw, Plus } from 'lucide-react';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';
import { usePanelsTheme } from '../../../theme/panelsTheme';
import { TerminalService } from '../../../main-process-api/TerminalService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { TerminalInfo } from '../../../../shared/main-process-api-interfaces/TerminalService';
import { TerminalListItem } from './components/TerminalListItem';
import { TerminalDetailsPanel } from './components/TerminalDetailsPanel';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';

interface TerminalManagerProps {
  sidebarCollapsed?: boolean;
}

export const TerminalManager: React.FC<TerminalManagerProps> = ({ sidebarCollapsed = false }) => {
  const { theme } = useTheme();
  const panelsTheme = usePanelsTheme();
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [terminalWindows, setTerminalWindows] = useState<Map<string, number>>(new Map());
  const [creatingTerminal, setCreatingTerminal] = useState(false);
  const [panelSizes, setPanelSizes] = useState({ left: 25, right: 75 });

  // Use panel persistence hook
  const panelState = usePanelPersistence({
    viewKey: 'terminalManager',
    defaultSizes: panelSizes,
    collapsed: { left: sidebarCollapsed },
    panelType: 'two-panel',
  });

  const loadTerminals = useCallback(async () => {
    try {
      const terminalList = await TerminalService.list();
      setTerminals(terminalList || []);
      setError(null);

      // Auto-select first terminal if none selected
      if (!selectedTerminal && terminalList && terminalList.length > 0) {
        setSelectedTerminal(terminalList[0]);
      }
    } catch (err) {
      console.error('Failed to load terminals:', err);
      setError('Failed to load terminal sessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTerminal]);

  useEffect(() => {
    // Load initial data
    const initialize = async () => {
      // Load panel preferences
      try {
        const preferences = await UserPreferencesService.getPreferences();
        if (preferences.panelLayouts?.terminalManager?.sizes) {
          setPanelSizes(preferences.panelLayouts.terminalManager.sizes);
        }
      } catch (err) {
        console.error('Failed to load panel preferences:', err);
      }

      // Load terminals
      await loadTerminals();

      // Query existing open windows
      try {
        const openWindows = await TerminalService.getOpenWindows();
        if (openWindows && openWindows.length > 0) {
          const windowMap = new Map<string, number>();
          openWindows.forEach(({ terminalId, windowId }) => {
            windowMap.set(terminalId, windowId);
          });
          setTerminalWindows(windowMap);
        }
      } catch (err) {
        console.error('Failed to get open terminal windows:', err);
      }
    };

    initialize();

    // Auto-refresh every 5 seconds
    const interval = setInterval(loadTerminals, 5000);

    // Subscribe to terminal window events
    const unsubscribeReady = TerminalService.onWindowReady((data) => {
      if (data.terminalId && data.windowId !== undefined) {
        const { terminalId, windowId } = data;
        setTerminalWindows(prev => {
          const newMap = new Map(prev);
          newMap.set(terminalId, windowId);
          return newMap;
        });
      }
    });

    const unsubscribeClose = TerminalService.onWindowClose((data) => {
      if (data.terminalId) {
        const { terminalId } = data;
        setTerminalWindows(prev => {
          const newMap = new Map(prev);
          newMap.delete(terminalId);
          return newMap;
        });
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribeReady();
      unsubscribeClose();
    };
  }, [loadTerminals]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTerminals();
  };

  const handleCloseTerminal = async (sessionId: string) => {
    try {
      await TerminalService.destroy(sessionId);
      // Clear selection if this was selected
      if (selectedTerminal?.id === sessionId) {
        setSelectedTerminal(null);
      }
      // Refresh the list immediately
      loadTerminals();
    } catch (err) {
      console.error('Failed to close terminal:', err);
    }
  };

  const handlePopOut = async (sessionId: string) => {
    try {
      // Check if there's already a window open for this terminal
      const windowId = terminalWindows.get(sessionId);

      if (windowId !== undefined) {
        // Focus the existing window
        await TerminalService.focusWindow(windowId);
      } else {
        // Pop out to a new window
        await TerminalService.popOut(sessionId);
      }
    } catch (err) {
      console.error('Failed to open terminal window:', err);
    }
  };

  const handleCreateTerminal = async () => {
    setCreatingTerminal(true);
    try {
      // Get user's home directory
      const homeDirectory = await FileSystemService.getHomePath();

      // Create new terminal session in home directory
      const sessionId = await TerminalService.create(homeDirectory);

      // Refresh terminal list
      await loadTerminals();

      // Find and select the new terminal
      const terminalList = await TerminalService.list();
      const newTerminal = terminalList?.find(t => t.id === sessionId);
      if (newTerminal) {
        setSelectedTerminal(newTerminal);
      }
    } catch (err) {
      console.error('Failed to create terminal:', err);
      setError('Failed to create new terminal session');
    } finally {
      setCreatingTerminal(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // Helper to get session number for terminals in the same directory
  const getSessionNumber = (terminal: TerminalInfo) => {
    const sameDirTerminals = terminals
      .filter(t => t.directory === terminal.directory)
      .sort((a, b) => a.createdAt - b.createdAt);

    const index = sameDirTerminals.findIndex(t => t.id === terminal.id);
    return sameDirTerminals.length > 1 ? index + 1 : 0;
  };

  // Render left panel - Terminal list sidebar
  const renderLeftPanel = () => {
    return (
      <div style={{
        height: '100%',
        backgroundColor: theme.colors.backgroundSecondary,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            color: theme.colors.text,
            margin: 0,
          }}>
            Terminal Sessions
          </h3>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleCreateTerminal}
              disabled={creatingTerminal}
              style={{
                padding: '4px 8px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '4px',
                cursor: creatingTerminal ? 'not-allowed' : 'pointer',
                opacity: creatingTerminal ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: theme.fontSizes[1],
              }}
              title="New Terminal"
            >
              <Plus size={14} />
              New
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                color: theme.colors.text,
                border: 'none',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                opacity: refreshing ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Refresh"
            >
              <RefreshCw size={16} style={{
                animation: refreshing ? 'spin 1s linear infinite' : 'none'
              }} />
            </button>
          </div>
        </div>

        {/* Terminal List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
        }}>
          {loading ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
            }}>
              Loading sessions...
            </div>
          ) : error ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.error,
              fontSize: theme.fontSizes[1],
            }}>
              {error}
            </div>
          ) : terminals.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
            }}>
              No active terminal sessions
              <div style={{
                marginTop: '8px',
                fontSize: theme.fontSizes[0],
              }}>
                Open a terminal from a repository to see it here
              </div>
            </div>
          ) : (
            <div>
              {terminals.map((terminal) => (
                <TerminalListItem
                  key={terminal.id}
                  terminal={terminal}
                  sessionNumber={getSessionNumber(terminal)}
                  isSelected={selectedTerminal?.id === terminal.id}
                  hasWindow={terminalWindows.has(terminal.id)}
                  onSelect={() => setSelectedTerminal(terminal)}
                  onClose={() => handleCloseTerminal(terminal.id)}
                  formatTime={formatTime}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add CSS animation for refresh spinner */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  };

  // Render right panel - Terminal details/viewer
  const renderRightPanel = () => {
    return (
      <TerminalDetailsPanel
        terminal={selectedTerminal}
        hasWindow={selectedTerminal ? terminalWindows.has(selectedTerminal.id) : false}
        onPopOut={handlePopOut}
        formatTime={formatTime}
        theme={theme}
      />
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AnimatedResizableLayout
        leftPanel={renderLeftPanel()}
        rightPanel={renderRightPanel()}
        minSize={15}
        defaultSize={panelState.type === 'two-panel' ? panelState.sizes.left : 25}
        collapsibleSide="left"
        collapsed={panelState.collapsed.left}
        style={{ height: '100%', width: '100%' }}
        theme={panelsTheme}
        onCollapseComplete={panelState.handleLeftCollapseComplete}
        onExpandComplete={panelState.handleLeftExpandComplete}
      />
    </div>
  );
};
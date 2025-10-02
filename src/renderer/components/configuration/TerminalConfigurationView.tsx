import React, { useState, useEffect } from 'react';
import { Terminal, Check, TestTube, FolderOpen } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import {
  TerminalId,
  TERMINAL_LABELS,
  DEFAULT_TERMINAL,
} from '../../../shared/types/terminal.types';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { ShellService } from '../../main-process-api/ShellService';

export const TerminalConfigurationView: React.FC = () => {
  const { theme } = useTheme();
  const [selectedTerminal, setSelectedTerminal] =
    useState<TerminalId>(DEFAULT_TERMINAL);
  const [testStatus, setTestStatus] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await UserPreferencesService.getPreferences();
      if (prefs.defaultTerminal) {
        setSelectedTerminal(prefs.defaultTerminal);
      }
    } catch (error) {
      console.error('Failed to load terminal preferences:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await UserPreferencesService.updatePreferences({
        defaultTerminal: selectedTerminal,
      });
      setTestStatus('Terminal preference saved successfully!');
      setTimeout(() => setTestStatus(''), 3000);
    } catch (error) {
      console.error('Failed to save terminal preference:', error);
      setTestStatus('Failed to save preference');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestStatus('Opening terminal...');
    try {
      // Get home directory for test
      const homeDir =
        process.platform === 'win32'
          ? process.env.USERPROFILE || 'C:\\'
          : process.env.HOME || '/';

      const result = await ShellService.openInTerminal({
        terminal: selectedTerminal,
        dir: homeDir,
      });

      if (result.success) {
        setTestStatus(
          `Successfully opened ${TERMINAL_LABELS[selectedTerminal]}!`,
        );
      } else {
        setTestStatus(
          `Failed to open terminal: ${result.error || 'Unknown error'}`,
        );
      }
    } catch (error) {
      console.error('Failed to test terminal:', error);
      setTestStatus('Failed to open terminal');
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestStatus(''), 5000);
    }
  };

  const terminals: TerminalId[] = [
    'terminal',
    'iterm2',
    'warp',
    'kitty',
    'alacritty',
    'wezterm',
    'ghostty',
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
          }}
        >
          <Terminal size={28} color={theme.colors.primary} />
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>
            Terminal Configuration
          </h2>
        </div>
        <p style={{ color: theme.colors.textSecondary, margin: 0 }}>
          Choose your preferred terminal emulator for opening shell sessions
        </p>
      </div>

      {/* Terminal Selection */}
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Select Default Terminal
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '12px',
          }}
        >
          {terminals.map((terminalId) => (
            <button
              key={terminalId}
              onClick={() => setSelectedTerminal(terminalId)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: `2px solid ${selectedTerminal === terminalId ? theme.colors.primary : theme.colors.border}`,
                backgroundColor:
                  selectedTerminal === terminalId
                    ? theme.colors.primary + '20'
                    : theme.colors.background,
                color: theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Terminal size={24} />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: selectedTerminal === terminalId ? 600 : 500,
                }}
              >
                {TERMINAL_LABELS[terminalId]}
              </span>
              {selectedTerminal === terminalId && (
                <Check size={16} color={theme.colors.primary} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Test Section */}
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Test Terminal
        </h3>
        <p style={{ color: theme.colors.textSecondary, marginBottom: '16px' }}>
          Test opening your selected terminal in your home directory
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleTest}
            disabled={isTesting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              fontSize: '14px',
              fontWeight: 600,
              cursor: isTesting ? 'not-allowed' : 'pointer',
              opacity: isTesting ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            <TestTube size={16} />
            {isTesting ? 'Testing...' : 'Test Terminal'}
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.primary}`,
              backgroundColor: 'transparent',
              color: theme.colors.primary,
              fontSize: '14px',
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            <Check size={16} />
            {isSaving ? 'Saving...' : 'Save Preference'}
          </button>
        </div>

        {testStatus && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: testStatus.includes('Failed')
                ? theme.colors.error + '20'
                : theme.colors.success + '20',
              color: testStatus.includes('Failed')
                ? theme.colors.error
                : theme.colors.success,
              fontSize: '14px',
            }}
          >
            {testStatus}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div
        style={{
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          About Terminal Integration
        </h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: '20px',
            lineHeight: 1.6,
            color: theme.colors.textSecondary,
          }}
        >
          <li>
            The selected terminal will be used when starting new agent sessions
          </li>
          <li>
            Sessions will automatically navigate to the correct repository
            directory
          </li>
          <li>Make sure your selected terminal is installed on your system</li>
          <li>
            On macOS, terminals are opened using the system's <code>open</code>{' '}
            command
          </li>
        </ul>
      </div>
    </div>
  );
};

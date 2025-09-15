import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Bell, BellOff, Clock, Download } from 'lucide-react';
import { AgentAutoUpdateService, AgentUpdatePreferences } from '../../main-process-api/AgentAutoUpdateService';

export const AgentAutoUpdateSettings: React.FC = () => {
  const { theme } = useTheme();
  const [preferences, setPreferences] = useState<AgentUpdatePreferences>({
    enabled: true,
    checkInterval: 24,
    autoInstall: false,
    notifyOnly: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await AgentAutoUpdateService.getUpdatePreferences();
      setPreferences(prefs);
      
      if (prefs.lastCheckTime) {
        const date = new Date(prefs.lastCheckTime);
        setLastCheckTime(date.toLocaleString());
      }
    } catch (error) {
      console.error('Failed to load auto-update preferences:', error);
    }
  };

  const handleToggleEnabled = async () => {
    const newPrefs = { ...preferences, enabled: !preferences.enabled };
    await savePreferences(newPrefs);
  };

  const handleToggleAutoInstall = async () => {
    const newPrefs = { 
      ...preferences, 
      autoInstall: !preferences.autoInstall,
      notifyOnly: preferences.autoInstall, // If enabling auto-install, disable notify-only
    };
    await savePreferences(newPrefs);
  };

  const handleIntervalChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPrefs = { ...preferences, checkInterval: parseInt(event.target.value) };
    await savePreferences(newPrefs);
  };

  const savePreferences = async (newPrefs: AgentUpdatePreferences) => {
    setIsSaving(true);
    try {
      await AgentAutoUpdateService.saveUpdatePreferences(newPrefs);
      setPreferences(newPrefs);
    } catch (error) {
      console.error('Failed to save auto-update preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const checkNow = async () => {
    setIsSaving(true);
    try {
      await AgentAutoUpdateService.checkAllForUpdates();
      await loadPreferences(); // Reload to get new last check time
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        padding: '24px',
      }}
    >
      <h3
        style={{
          margin: '0 0 20px 0',
          color: theme.colors.text,
          fontSize: '18px',
          fontWeight: 600,
        }}
      >
        Agent Auto-Update Settings
      </h3>

      {/* Enable/Disable Auto-Update */}
      <div style={{ marginBottom: '24px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={preferences.enabled}
            onChange={handleToggleEnabled}
            disabled={isSaving}
            style={{
              width: '20px',
              height: '20px',
              cursor: 'pointer',
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {preferences.enabled ? <Bell size={18} /> : <BellOff size={18} />}
              <span style={{ color: theme.colors.text, fontWeight: 500 }}>
                Enable Auto-Update Checks
              </span>
            </div>
            <p
              style={{
                margin: '4px 0 0 26px',
                fontSize: '13px',
                color: theme.colors.textSecondary,
              }}
            >
              Automatically check for updates to Gemini and OpenCode CLI tools
            </p>
          </div>
        </label>
      </div>

      {/* Check Interval */}
      {preferences.enabled && (
        <>
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                color: theme.colors.text,
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <Clock size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
              Check Frequency
            </label>
            <select
              value={preferences.checkInterval}
              onChange={handleIntervalChange}
              disabled={isSaving}
              style={{
                width: '200px',
                padding: '8px 12px',
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="6">Every 6 hours</option>
              <option value="12">Every 12 hours</option>
              <option value="24">Every 24 hours</option>
              <option value="48">Every 2 days</option>
              <option value="168">Weekly</option>
            </select>
            {lastCheckTime && (
              <p
                style={{
                  margin: '8px 0 0 0',
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                Last checked: {lastCheckTime}
              </p>
            )}
          </div>

          {/* Auto-Install Option */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={preferences.autoInstall}
                onChange={handleToggleAutoInstall}
                disabled={isSaving}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={18} />
                  <span style={{ color: theme.colors.text, fontWeight: 500 }}>
                    Automatically Install Updates
                  </span>
                </div>
                <p
                  style={{
                    margin: '4px 0 0 26px',
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  {preferences.autoInstall
                    ? 'Updates will be installed automatically in the background'
                    : 'You will be notified when updates are available'}
                </p>
              </div>
            </label>
          </div>
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={checkNow}
          disabled={isSaving || !preferences.enabled}
          style={{
            padding: '10px 20px',
            backgroundColor: theme.colors.primary,
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: isSaving || !preferences.enabled ? 'not-allowed' : 'pointer',
            opacity: isSaving || !preferences.enabled ? 0.6 : 1,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {isSaving ? 'Checking...' : 'Check for Updates Now'}
        </button>
      </div>
    </div>
  );
};
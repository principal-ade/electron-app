import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Bell, BellOff, Clock, Download } from 'lucide-react';
import { AgentAutoUpdateService } from '../../main-process-api/AgentAutoUpdateService';
export const AgentAutoUpdateSettings = () => {
    const { theme } = useTheme();
    const [preferences, setPreferences] = useState({
        enabled: true,
        checkInterval: 24,
        autoInstall: false,
        notifyOnly: true,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [lastCheckTime, setLastCheckTime] = useState(null);
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
        }
        catch (error) {
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
    const handleIntervalChange = async (event) => {
        const newPrefs = { ...preferences, checkInterval: parseInt(event.target.value) };
        await savePreferences(newPrefs);
    };
    const savePreferences = async (newPrefs) => {
        setIsSaving(true);
        try {
            await AgentAutoUpdateService.saveUpdatePreferences(newPrefs);
            setPreferences(newPrefs);
        }
        catch (error) {
            console.error('Failed to save auto-update preferences:', error);
        }
        finally {
            setIsSaving(false);
        }
    };
    const checkNow = async () => {
        setIsSaving(true);
        try {
            await AgentAutoUpdateService.checkAllForUpdates();
            await loadPreferences(); // Reload to get new last check time
        }
        catch (error) {
            console.error('Failed to check for updates:', error);
        }
        finally {
            setIsSaving(false);
        }
    };
    return (_jsxs("div", { style: {
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            padding: '24px',
        }, children: [_jsx("h3", { style: {
                    margin: '0 0 20px 0',
                    color: theme.colors.text,
                    fontSize: '18px',
                    fontWeight: 600,
                }, children: "Agent Auto-Update Settings" }), _jsx("div", { style: { marginBottom: '24px' }, children: _jsxs("label", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                    }, children: [_jsx("input", { type: "checkbox", checked: preferences.enabled, onChange: handleToggleEnabled, disabled: isSaving, style: {
                                width: '20px',
                                height: '20px',
                                cursor: 'pointer',
                            } }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [preferences.enabled ? _jsx(Bell, { size: 18 }) : _jsx(BellOff, { size: 18 }), _jsx("span", { style: { color: theme.colors.text, fontWeight: 500 }, children: "Enable Auto-Update Checks" })] }), _jsx("p", { style: {
                                        margin: '4px 0 0 26px',
                                        fontSize: '13px',
                                        color: theme.colors.textSecondary,
                                    }, children: "Automatically check for updates to Gemini and OpenCode CLI tools" })] })] }) }), preferences.enabled && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginBottom: '24px' }, children: [_jsxs("label", { style: {
                                    display: 'block',
                                    marginBottom: '8px',
                                    color: theme.colors.text,
                                    fontSize: '14px',
                                    fontWeight: 500,
                                }, children: [_jsx(Clock, { size: 16, style: { marginRight: '6px', verticalAlign: 'text-bottom' } }), "Check Frequency"] }), _jsxs("select", { value: preferences.checkInterval, onChange: handleIntervalChange, disabled: isSaving, style: {
                                    width: '200px',
                                    padding: '8px 12px',
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.text,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                }, children: [_jsx("option", { value: "6", children: "Every 6 hours" }), _jsx("option", { value: "12", children: "Every 12 hours" }), _jsx("option", { value: "24", children: "Every 24 hours" }), _jsx("option", { value: "48", children: "Every 2 days" }), _jsx("option", { value: "168", children: "Weekly" })] }), lastCheckTime && (_jsxs("p", { style: {
                                    margin: '8px 0 0 0',
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                }, children: ["Last checked: ", lastCheckTime] }))] }), _jsx("div", { style: { marginBottom: '24px' }, children: _jsxs("label", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                            }, children: [_jsx("input", { type: "checkbox", checked: preferences.autoInstall, onChange: handleToggleAutoInstall, disabled: isSaving, style: {
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer',
                                    } }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Download, { size: 18 }), _jsx("span", { style: { color: theme.colors.text, fontWeight: 500 }, children: "Automatically Install Updates" })] }), _jsx("p", { style: {
                                                margin: '4px 0 0 26px',
                                                fontSize: '13px',
                                                color: theme.colors.textSecondary,
                                            }, children: preferences.autoInstall
                                                ? 'Updates will be installed automatically in the background'
                                                : 'You will be notified when updates are available' })] })] }) })] })), _jsx("div", { style: { display: 'flex', gap: '12px' }, children: _jsx("button", { onClick: checkNow, disabled: isSaving || !preferences.enabled, style: {
                        padding: '10px 20px',
                        backgroundColor: theme.colors.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isSaving || !preferences.enabled ? 'not-allowed' : 'pointer',
                        opacity: isSaving || !preferences.enabled ? 0.6 : 1,
                        fontSize: '14px',
                        fontWeight: 500,
                    }, children: isSaving ? 'Checking...' : 'Check for Updates Now' }) })] }));
};

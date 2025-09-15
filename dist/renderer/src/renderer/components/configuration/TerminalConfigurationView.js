import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Terminal, Check, TestTube } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { TERMINAL_LABELS, DEFAULT_TERMINAL } from '../../../shared/types/terminal.types';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { ShellService } from '../../main-process-api/ShellService';
export const TerminalConfigurationView = () => {
    const { theme } = useTheme();
    const [selectedTerminal, setSelectedTerminal] = useState(DEFAULT_TERMINAL);
    const [testStatus, setTestStatus] = useState('');
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
        }
        catch (error) {
            console.error('Failed to load terminal preferences:', error);
        }
    };
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await UserPreferencesService.updatePreferences({
                defaultTerminal: selectedTerminal
            });
            setTestStatus('Terminal preference saved successfully!');
            setTimeout(() => setTestStatus(''), 3000);
        }
        catch (error) {
            console.error('Failed to save terminal preference:', error);
            setTestStatus('Failed to save preference');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleTest = async () => {
        setIsTesting(true);
        setTestStatus('Opening terminal...');
        try {
            // Get home directory for test
            const homeDir = process.platform === 'win32'
                ? process.env.USERPROFILE || 'C:\\'
                : process.env.HOME || '/';
            const result = await ShellService.openInTerminal({
                terminal: selectedTerminal,
                dir: homeDir
            });
            if (result.success) {
                setTestStatus(`Successfully opened ${TERMINAL_LABELS[selectedTerminal]}!`);
            }
            else {
                setTestStatus(`Failed to open terminal: ${result.error || 'Unknown error'}`);
            }
        }
        catch (error) {
            console.error('Failed to test terminal:', error);
            setTestStatus('Failed to open terminal');
        }
        finally {
            setIsTesting(false);
            setTimeout(() => setTestStatus(''), 5000);
        }
    };
    const terminals = ['terminal', 'iterm2', 'warp', 'kitty', 'alacritty', 'wezterm', 'ghostty'];
    return (_jsxs("div", { style: { padding: '32px', maxWidth: '800px', margin: '0 auto' }, children: [_jsxs("div", { style: { marginBottom: '32px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }, children: [_jsx(Terminal, { size: 28, color: theme.colors.primary }), _jsx("h2", { style: { fontSize: '24px', fontWeight: 600, margin: 0 }, children: "Terminal Configuration" })] }), _jsx("p", { style: { color: theme.colors.textSecondary, margin: 0 }, children: "Choose your preferred terminal emulator for opening shell sessions" })] }), _jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '24px',
                }, children: [_jsx("h3", { style: { fontSize: '16px', fontWeight: 600, marginBottom: '16px' }, children: "Select Default Terminal" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }, children: terminals.map((terminalId) => (_jsxs("button", { onClick: () => setSelectedTerminal(terminalId), style: {
                                padding: '12px',
                                borderRadius: '8px',
                                border: `2px solid ${selectedTerminal === terminalId ? theme.colors.primary : theme.colors.border}`,
                                backgroundColor: selectedTerminal === terminalId ? theme.colors.primary + '20' : theme.colors.background,
                                color: theme.colors.text,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                            }, children: [_jsx(Terminal, { size: 24 }), _jsx("span", { style: { fontSize: '14px', fontWeight: selectedTerminal === terminalId ? 600 : 500 }, children: TERMINAL_LABELS[terminalId] }), selectedTerminal === terminalId && (_jsx(Check, { size: 16, color: theme.colors.primary }))] }, terminalId))) })] }), _jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '24px',
                }, children: [_jsx("h3", { style: { fontSize: '16px', fontWeight: 600, marginBottom: '16px' }, children: "Test Terminal" }), _jsx("p", { style: { color: theme.colors.textSecondary, marginBottom: '16px' }, children: "Test opening your selected terminal in your home directory" }), _jsxs("div", { style: { display: 'flex', gap: '12px', alignItems: 'center' }, children: [_jsxs("button", { onClick: handleTest, disabled: isTesting, style: {
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
                                }, children: [_jsx(TestTube, { size: 16 }), isTesting ? 'Testing...' : 'Test Terminal'] }), _jsxs("button", { onClick: handleSave, disabled: isSaving, style: {
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
                                }, children: [_jsx(Check, { size: 16 }), isSaving ? 'Saving...' : 'Save Preference'] })] }), testStatus && (_jsx("div", { style: {
                            marginTop: '16px',
                            padding: '12px',
                            borderRadius: '8px',
                            backgroundColor: testStatus.includes('Failed') ? theme.colors.error + '20' : theme.colors.success + '20',
                            color: testStatus.includes('Failed') ? theme.colors.error : theme.colors.success,
                            fontSize: '14px',
                        }, children: testStatus }))] }), _jsxs("div", { style: {
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '12px',
                    padding: '24px',
                }, children: [_jsx("h3", { style: { fontSize: '16px', fontWeight: 600, marginBottom: '12px' }, children: "About Terminal Integration" }), _jsxs("ul", { style: { margin: 0, paddingLeft: '20px', lineHeight: 1.6, color: theme.colors.textSecondary }, children: [_jsx("li", { children: "The selected terminal will be used when starting new agent sessions" }), _jsx("li", { children: "Sessions will automatically navigate to the correct repository directory" }), _jsx("li", { children: "Make sure your selected terminal is installed on your system" }), _jsxs("li", { children: ["On macOS, terminals are opened using the system's ", _jsx("code", { children: "open" }), " command"] })] })] })] }));
};

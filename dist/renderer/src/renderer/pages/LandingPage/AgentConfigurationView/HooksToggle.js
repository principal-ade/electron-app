import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { getAgentInfo } from "@principal-ai/agent-monitoring";
import { useTheme } from 'themed-markdown';
import { AgentConfigurationService } from '../../../main-process-api/AgentConfigurationService';
export const HooksToggle = ({ agentType, onToggle, hooksEnabled, className = '', }) => {
    const { theme } = useTheme();
    const [isToggling, setIsToggling] = useState(false);
    const [error, setError] = useState(null);
    console.log('HooksToggle', agentType, hooksEnabled);
    const handleToggle = useCallback(async () => {
        setIsToggling(true);
        try {
            let success = false;
            console.log('handleToggle', agentType, hooksEnabled);
            if (hooksEnabled) {
                // Disable hooks - save current hooks configuration first
                // Use the proper IPC handler to remove all hooks
                const result = await AgentConfigurationService.removeHooksFromAgent(agentType);
                success = result;
            }
            else {
                // Enable hooks - use the proper IPC handler to add hooks
                const result = await AgentConfigurationService.addHooksToAgent(agentType);
                success = result;
            }
            if (success) {
                onToggle(!hooksEnabled);
                setError(null);
            }
            else {
                // Check if this is an OpenCode plugin system error
                if (agentType === 'opencode' && !hooksEnabled) {
                    setError('OpenCode uses a plugin system. Hooks are not supported.');
                }
                else {
                    setError('Failed to toggle hooks. Please try again.');
                }
            }
        }
        catch (error) {
            console.error('Failed to toggle hooks:', error);
            setError('An unexpected error occurred.');
        }
        finally {
            setIsToggling(false);
        }
    }, [agentType, hooksEnabled, onToggle]);
    const agentInfo = getAgentInfo(agentType);
    // Disable toggle for OpenCode
    const isOpenCode = agentType === 'opencode';
    const isDisabled = isToggling || isOpenCode;
    return (_jsxs("div", { className: `flex flex-col gap-2 ${className}`, children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: handleToggle, disabled: isDisabled, className: `relative inline-flex items-center h-8 w-14 rounded-full transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`, style: {
                            backgroundColor: hooksEnabled && !isOpenCode ? agentInfo.ui.color : '#64748b',
                        }, title: isOpenCode
                            ? 'OpenCode uses a plugin system'
                            : hooksEnabled
                                ? 'Disable all hooks'
                                : 'Enable hooks', children: _jsx("span", { className: `
            inline-block h-6 w-6 transform rounded-full bg-white transition-transform
            ${hooksEnabled ? 'translate-x-7' : 'translate-x-1'}
          `, children: hooksEnabled ? (_jsx(ToggleRight, { size: 24, style: { color: agentInfo.ui.color } })) : (_jsx(ToggleLeft, { size: 24, style: { color: theme.colors.textSecondary } })) }) }), _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "text-sm font-medium", children: isOpenCode ? 'Plugin System' : `Hooks ${hooksEnabled ? 'Enabled' : 'Disabled'}` }), isToggling && (_jsx("span", { className: "text-xs", style: { color: theme.colors.textSecondary }, children: hooksEnabled ? 'Disabling...' : 'Enabling...' })), isOpenCode && (_jsx("span", { className: "text-xs", style: { color: theme.colors.textSecondary }, children: "Use OpenCode plugins instead" }))] })] }), error && (_jsxs("div", { className: "text-xs text-red-500 flex items-center gap-1 ml-1", children: [_jsx(AlertCircle, { size: 12 }), error] }))] }));
};

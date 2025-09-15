import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { AgentConfigurationService } from '../../../main-process-api/AgentConfigurationService';
import { getAvailableHookTypes, getHookTypeDisplayName, getHookTypeDescription, hookTypeUsesMatchers, getDefaultMatcher, } from '../../../utils/hooks/hookTypes';
import { HookSquare } from './HookSquare';
import { HookTypeCard } from './HookTypeCard';
export const HooksGrid = ({ agentType, color, onHooksChange, showAddFormRef, layout = 'grid', }) => {
    const { theme } = useTheme();
    const [hooksData, setHooksData] = useState({});
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newMatcher, setNewMatcher] = useState('*');
    const [newCommand, setNewCommand] = useState('');
    const [editingHook, setEditingHook] = useState(null);
    const [infoHook, setInfoHook] = useState(null);
    const [selectedHookType, setSelectedHookType] = useState(null);
    const [hoveredElements, setHoveredElements] = useState({});
    const [availableHookTypes, setAvailableHookTypes] = useState([]);
    useEffect(() => {
        const types = getAvailableHookTypes(agentType);
        setAvailableHookTypes(types);
        loadHooks(types);
    }, [agentType]);
    const loadHooks = async (hookTypes) => {
        setLoading(true);
        const typesToLoad = hookTypes || availableHookTypes;
        try {
            const config = await AgentConfigurationService.readAgentSettings(agentType);
            const newHooksData = {};
            // Load hooks for all available hook types
            // The main process now normalizes the hooks format for all agents
            if (config?.hooks) {
                for (const hookType of typesToLoad) {
                    if (config.hooks[hookType]) {
                        newHooksData[hookType] = config.hooks[hookType];
                    }
                    else {
                        newHooksData[hookType] = [];
                    }
                }
            }
            else {
                // Initialize empty arrays for all hook types
                for (const hookType of typesToLoad) {
                    newHooksData[hookType] = [];
                }
            }
            setHooksData(newHooksData);
        }
        catch (error) {
            console.error('Failed to load hooks:', error);
            // Initialize empty arrays for all hook types on error
            const emptyHooksData = {};
            for (const hookType of typesToLoad) {
                emptyHooksData[hookType] = [];
            }
            setHooksData(emptyHooksData);
        }
        finally {
            setLoading(false);
        }
    };
    /**
     * Hook Configuration Structure in JSON:
     * {
     *   "hooks": {
     *     "PostToolUse": [{
     *       "matcher": "*",           // Pattern to match tool names (* = all tools)
     *       "hooks": [{
     *         "type": "command",      // Hook type (currently only 'command' supported)
     *         "command": "/path/to/script.js"  // Full path to executable
     *       }]
     *     }],
     *     "Stop": [{
     *       "matcher": "",            // Stop hooks don't use matchers
     *       "hooks": [{
     *         "type": "command",
     *         "command": "/path/to/stop-script.js"
     *       }]
     *     }]
     *   }
     * }
     *
     * We parse this JSON structure and filter hooks by their command filepath
     * when removing/updating specific hooks.
     */
    const saveHooks = async (updatedHooks, hookType) => {
        try {
            const config = (await AgentConfigurationService.readAgentSettings(agentType)) || {};
            // The main process now handles format conversion for all agents
            if (!config.hooks)
                config.hooks = {};
            config.hooks[hookType] = updatedHooks;
            const success = await AgentConfigurationService.updateAgentSettings(agentType, config);
            if (success) {
                setHooksData(prev => ({
                    ...prev,
                    [hookType]: updatedHooks,
                }));
                onHooksChange?.();
            }
        }
        catch (error) {
            console.error('Failed to save hooks:', error);
        }
    };
    const handleAddHook = async () => {
        if (!newCommand.trim() || !selectedHookType)
            return;
        const currentHooksList = hooksData[selectedHookType] || [];
        const newHook = {
            matcher: hookTypeUsesMatchers(selectedHookType) ? newMatcher : '',
            hooks: [
                {
                    type: 'command',
                    command: newCommand.trim(),
                },
            ],
        };
        const updatedHooks = [...currentHooksList, newHook];
        await saveHooks(updatedHooks, selectedHookType);
        setShowAddForm(false);
        setNewMatcher(getDefaultMatcher(selectedHookType));
        setNewCommand('');
    };
    const handleUpdateHook = async (oldMatcher, oldCommand, newMatcher, newCommand) => {
        if (!editingHook)
            return;
        const currentHooksList = hooksData[editingHook.hookType] || [];
        const hookIndex = currentHooksList.findIndex((h) => h.matcher === oldMatcher &&
            h.hooks.some((hk) => hk.command === oldCommand));
        if (hookIndex !== -1) {
            const updatedHooks = [...currentHooksList];
            updatedHooks[hookIndex] = {
                matcher: hookTypeUsesMatchers(editingHook.hookType) ? newMatcher : '',
                hooks: [
                    {
                        type: 'command',
                        command: newCommand,
                    },
                ],
            };
            await saveHooks(updatedHooks, editingHook.hookType);
        }
        setEditingHook(null);
    };
    const handleRemoveHook = async (matcher, command) => {
        if (!selectedHookType)
            return;
        const currentHooksList = hooksData[selectedHookType] || [];
        const updatedHooks = currentHooksList.filter((h) => !(h.matcher === matcher && h.hooks.some((hk) => hk.command === command)));
        await saveHooks(updatedHooks, selectedHookType);
    };
    /**
     * Note: To support enable/disable functionality, we would need to extend
     * the hook structure to include an 'enabled' field:
     *
     * hooks: [{
     *   type: 'command',
     *   command: '/path/to/script.js',
     *   enabled: true  // New field to track enabled state
     * }]
     *
     * Currently, hooks are either present (enabled) or absent (disabled).
     * Removing a hook is the only way to "disable" it.
     */
    // Auto-configure standard hooks
    const autoConfigureHooks = async () => {
        try {
            const config = await AgentConfigurationService.readAgentSettings(agentType) || {};
            const hookPaths = await AgentConfigurationService.getAgentHooksFilePath(agentType);
            // The main process now handles format conversion for all agents
            if (!config.hooks)
                config.hooks = {};
            // Configure hooks for all available types
            for (const hookType of availableHookTypes) {
                if (!config.hooks[hookType] || config.hooks[hookType].length === 0) {
                    config.hooks[hookType] = [
                        {
                            matcher: getDefaultMatcher(hookType),
                            hooks: [
                                {
                                    type: 'command',
                                    command: hookPaths,
                                },
                            ],
                        },
                    ];
                }
            }
            const success = await AgentConfigurationService.updateAgentSettings(agentType, config);
            if (success) {
                await loadHooks();
                // Trigger the parent component to refresh agent status
                onHooksChange?.();
            }
        }
        catch (error) {
            console.error('Failed to auto-configure hooks:', error);
        }
    };
    if (loading) {
        return (_jsx("div", { className: "text-center py-8", children: _jsx("div", { style: { color: theme.colors.textSecondary }, children: "Loading hooks..." }) }));
    }
    // Count configured hooks for each type
    const hookCounts = {};
    for (const hookType of availableHookTypes) {
        const typeHooks = hooksData[hookType] || [];
        hookCounts[hookType] = typeHooks.reduce((sum, hook) => sum + hook.hooks.length, 0);
    }
    const totalHookCount = Object.values(hookCounts).reduce((sum, count) => sum + count, 0);
    // If no hook type selected, show the overview
    if (!selectedHookType) {
        const gridCols = availableHookTypes.length <= 2 ? 'grid-cols-2' :
            availableHookTypes.length <= 3 ? 'grid-cols-3' :
                'grid-cols-2 lg:grid-cols-3';
        return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: `grid ${gridCols} gap-4`, children: availableHookTypes.map((hookType) => (_jsx(HookTypeCard, { type: getHookTypeDisplayName(hookType), count: hookCounts[hookType], configured: hookCounts[hookType] > 0, color: color, onClick: () => setSelectedHookType(hookType), description: getHookTypeDescription(hookType) }, hookType))) }), totalHookCount < availableHookTypes.length && (_jsx("div", { className: "mt-6 text-center", children: _jsx("button", { onClick: async () => {
                            await autoConfigureHooks();
                        }, className: "px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors", children: "Quick Setup All Hook Types" }) }))] }));
    }
    // Show detailed view for selected hook type
    const currentHooks = hooksData[selectedHookType] || [];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("button", { onClick: () => setSelectedHookType(null), className: "flex items-center gap-2 text-sm transition-colors", style: { color: hoveredElements['back-button'] ? theme.colors.text : theme.colors.textSecondary }, onMouseEnter: () => setHoveredElements(prev => ({ ...prev, 'back-button': true })), onMouseLeave: () => setHoveredElements(prev => ({ ...prev, 'back-button': false })), children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }), "Back to Hook Types"] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-lg font-semibold", children: [getHookTypeDisplayName(selectedHookType), " Hooks"] }), currentHooks.length > 0 && (_jsxs("button", { onClick: async () => {
                            const confirmed = window.confirm(`Are you sure you want to remove all ${selectedHookType} hooks? This action cannot be undone.`);
                            if (confirmed) {
                                await saveHooks([], selectedHookType);
                            }
                        }, className: "px-3 py-1.5 text-xs text-red-400 rounded-md transition-colors flex items-center gap-2", style: { backgroundColor: hoveredElements['clear-all'] ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)' }, onMouseEnter: () => setHoveredElements(prev => ({ ...prev, 'clear-all': true })), onMouseLeave: () => setHoveredElements(prev => ({ ...prev, 'clear-all': false })), title: "Remove all hooks", children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }), "Clear All"] }))] }), currentHooks.length === 0 && !showAddForm && (_jsxs("div", { className: "text-center py-16 rounded-lg", style: { backgroundColor: `${theme.colors.surface}80` }, children: [_jsx("div", { className: "w-16 h-16 mx-auto mb-4 rounded-lg flex items-center justify-center", style: { backgroundColor: `${theme.colors.backgroundTertiary}80` }, children: _jsx("svg", { className: "w-8 h-8", style: { color: theme.colors.textSecondary }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" }) }) }), _jsx("p", { className: "mb-4", style: { color: theme.colors.textSecondary }, children: "No hooks configured yet" }), _jsx("button", { onClick: () => setShowAddForm(true), className: "px-4 py-2 text-white rounded-md text-sm transition-colors", style: { backgroundColor: hoveredElements['add-first-hook'] ? theme.colors.textMuted : theme.colors.backgroundTertiary }, onMouseEnter: () => setHoveredElements(prev => ({ ...prev, 'add-first-hook': true })), onMouseLeave: () => setHoveredElements(prev => ({ ...prev, 'add-first-hook': false })), children: "Add Your First Hook" })] })), (showAddForm || editingHook) && (_jsxs("div", { className: "rounded-lg p-6 space-y-4", style: { backgroundColor: theme.colors.surface }, children: [_jsx("h4", { className: "font-medium text-lg mb-4", style: { color: theme.colors.text }, children: editingHook ? 'Configure Hook' : 'Add New Hook' }), _jsxs("div", { className: "space-y-4", children: [hookTypeUsesMatchers(selectedHookType) && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", style: { color: theme.colors.textTertiary }, children: "Matcher Pattern" }), _jsx("input", { type: "text", value: editingHook ? editingHook.matcher : newMatcher, onChange: (e) => {
                                            if (editingHook) {
                                                setEditingHook({
                                                    ...editingHook,
                                                    matcher: e.target.value,
                                                });
                                            }
                                            else {
                                                setNewMatcher(e.target.value);
                                            }
                                        }, className: "w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", placeholder: "e.g., * for all tools or specific tool name", style: { backgroundColor: theme.colors.background, color: theme.colors.text } }), _jsx("p", { className: "text-xs mt-1", style: { color: theme.colors.textMuted }, children: "Use * to match all tools, or specify tool names like \"Edit\", \"Read\", \"Bash\"" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", style: { color: theme.colors.textTertiary }, children: "Hook Script Path" }), _jsx("input", { type: "text", value: editingHook ? editingHook.command : newCommand, onChange: (e) => {
                                            if (editingHook) {
                                                setEditingHook({ ...editingHook, command: e.target.value });
                                            }
                                            else {
                                                setNewCommand(e.target.value);
                                            }
                                        }, className: "w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", placeholder: "e.g., ~/code-city/hooks/my-hook.sh", style: { backgroundColor: theme.colors.background, color: theme.colors.text } }), _jsx("p", { className: "text-xs mt-1", style: { color: theme.colors.textMuted }, children: "Full path to the executable script that will run when the hook is triggered" })] })] }), _jsxs("div", { className: "flex gap-2 justify-end pt-4 border-t", style: { borderColor: theme.colors.border }, children: [_jsx("button", { onClick: () => {
                                    setShowAddForm(false);
                                    setEditingHook(null);
                                    setNewMatcher(getDefaultMatcher(selectedHookType));
                                    setNewCommand('');
                                }, className: "px-4 py-2 text-sm text-white rounded transition-colors", style: { backgroundColor: hoveredElements['cancel-button'] ? theme.colors.textMuted : theme.colors.backgroundTertiary }, onMouseEnter: () => setHoveredElements(prev => ({ ...prev, 'cancel-button': true })), onMouseLeave: () => setHoveredElements(prev => ({ ...prev, 'cancel-button': false })), children: "Cancel" }), _jsx("button", { onClick: () => {
                                    if (editingHook) {
                                        const currentHooksList = hooksData[editingHook.hookType] || [];
                                        const originalHook = currentHooksList[editingHook.index];
                                        handleUpdateHook(originalHook.matcher || '', originalHook.hooks[0]?.command || '', editingHook.matcher, editingHook.command);
                                    }
                                    else {
                                        handleAddHook();
                                    }
                                }, disabled: editingHook ? !editingHook.command.trim() : !newCommand.trim(), className: "px-4 py-2 text-sm text-white rounded transition-colors", style: {
                                    backgroundColor: (editingHook ? editingHook.command.trim() : newCommand.trim())
                                        ? (hoveredElements['save-button'] ? '#1d4ed8' : '#2563eb')
                                        : theme.colors.backgroundTertiary,
                                    cursor: (editingHook ? editingHook.command.trim() : newCommand.trim()) ? 'pointer' : 'not-allowed'
                                }, onMouseEnter: () => {
                                    if (editingHook ? editingHook.command.trim() : newCommand.trim()) {
                                        setHoveredElements(prev => ({ ...prev, 'save-button': true }));
                                    }
                                }, onMouseLeave: () => setHoveredElements(prev => ({ ...prev, 'save-button': false })), children: editingHook ? 'Save Configuration' : 'Add Hook' })] })] })), _jsxs("div", { className: layout === 'grid' ? 'grid grid-cols-4 gap-3' : 'space-y-2', children: [currentHooks.map((hook, index) => hook.hooks.map((h, hIndex) => (_jsx(HookSquare, { command: h.command, matcher: hook.matcher || 'all', color: color, layout: layout, onEdit: () => {
                            setSelectedHookType(selectedHookType);
                            setEditingHook({
                                matcher: hook.matcher || '',
                                command: h.command,
                                index,
                                hookType: selectedHookType,
                            });
                        }, onRemove: () => handleRemoveHook(hook.matcher || '', h.command), onShowInfo: () => setInfoHook({
                            matcher: hook.matcher || 'all',
                            command: h.command,
                        }) }, `${index}-${hIndex}`)))), !showAddForm && !editingHook && (_jsxs("button", { onClick: () => setShowAddForm(true), className: `${layout === 'grid'
                            ? 'border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center transition-all group'
                            : 'w-full border-2 border-dashed rounded-lg px-4 py-3 flex items-center justify-center transition-all group'}`, style: {
                            backgroundColor: hoveredElements['add-hook-button'] ? theme.colors.surface : `${theme.colors.surface}80`,
                            borderColor: hoveredElements['add-hook-button'] ? theme.colors.textMuted : theme.colors.border
                        }, onMouseEnter: () => setHoveredElements(prev => ({ ...prev, 'add-hook-button': true })), onMouseLeave: () => setHoveredElements(prev => ({ ...prev, 'add-hook-button': false })), children: [_jsx("svg", { className: `${layout === 'grid' ? 'w-8 h-8 mb-1' : 'w-5 h-5 mr-2'}`, style: { color: hoveredElements['add-hook-button'] ? theme.colors.textTertiary : theme.colors.textMuted }, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }), _jsx("p", { className: `text-${layout === 'grid' ? 'xs' : 'sm'}`, style: { color: hoveredElements['add-hook-button'] ? theme.colors.textTertiary : theme.colors.textMuted }, children: "Add Hook" })] }))] }), infoHook && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "rounded-lg p-6 max-w-md w-full", style: { backgroundColor: theme.colors.background }, children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Hook Details" }), _jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Hook Name:" }), _jsx("span", { className: "ml-2", style: { color: theme.colors.text }, children: infoHook.command.split('/').pop() || infoHook.command })] }), _jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Matcher Pattern:" }), _jsx("code", { className: "ml-2 px-2 py-0.5 rounded text-xs", style: { backgroundColor: theme.colors.surface, color: theme.colors.text }, children: infoHook.matcher })] }), _jsxs("div", { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "Full Path:" }), _jsx("div", { className: "mt-1", children: _jsx("code", { className: "px-2 py-1 rounded text-xs break-all block", style: { backgroundColor: theme.colors.surface, color: theme.colors.text }, children: infoHook.command }) })] }), _jsxs("div", { className: "mt-2 text-xs", style: { color: theme.colors.textMuted }, children: ["This hook will run when tools matching \"", infoHook.matcher, "\" are used."] })] }), _jsx("button", { onClick: () => setInfoHook(null), className: "mt-6 w-full px-4 py-2 text-white rounded-md transition-colors", style: { backgroundColor: hoveredElements['close-modal'] ? theme.colors.backgroundTertiary : theme.colors.surface }, onMouseEnter: () => setHoveredElements(prev => ({ ...prev, 'close-modal': true })), onMouseLeave: () => setHoveredElements(prev => ({ ...prev, 'close-modal': false })), children: "Close" })] }) }))] }));
};

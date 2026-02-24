import React, { useState, useEffect } from 'react';

import { SupportedAgent } from '@principal-ai/agent-monitoring';
import { useTheme } from '@principal-ade/industry-theme';

import { AgentConfigurationService } from '../../../main-process-api/AgentConfigurationService';
import {
  getAvailableHookTypes,
  getHookTypeDisplayName,
  getHookTypeDescription,
  hookTypeUsesMatchers,
  getDefaultMatcher,
  type HookType,
} from '../../../utils/hooks/hookTypes';

import { HookSquare } from './HookSquare';
import { HookTypeCard } from './HookTypeCard';
import type {
  AgentHookConfig,
  AgentSettings,
} from '../../../../shared/types/agent-settings.types';

type Hook = AgentHookConfig;

interface HooksGridProps {
  agentType: SupportedAgent;
  color: string;
  onHooksChange?: () => void;
  showAddFormRef?: React.MutableRefObject<(() => void) | null>;
  layout?: 'grid' | 'list';
}

export const HooksGrid: React.FC<HooksGridProps> = ({
  agentType,
  color,
  onHooksChange,
  layout = 'grid',
}) => {
  const { theme } = useTheme();
  const [hooksData, setHooksData] = useState<Record<string, Hook[]>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMatcher, setNewMatcher] = useState('*');
  const [newCommand, setNewCommand] = useState('');
  const [editingHook, setEditingHook] = useState<{
    matcher: string;
    command: string;
    index: number;
    hookType: HookType;
  } | null>(null);
  const [infoHook, setInfoHook] = useState<{
    matcher: string;
    command: string;
  } | null>(null);
  const [selectedHookType, setSelectedHookType] = useState<HookType | null>(
    null,
  );
  const [hoveredElements, setHoveredElements] = useState<{
    [key: string]: boolean;
  }>({});
  const [availableHookTypes, setAvailableHookTypes] = useState<
    readonly HookType[]
  >([]);

  useEffect(() => {
    const types = getAvailableHookTypes(agentType);
    setAvailableHookTypes(types);
    loadHooks(types);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentType]);

  const ensureConfig = (config: AgentSettings | null): AgentSettings => ({
    provider: config?.provider ?? agentType,
    enabled: config?.enabled ?? false,
    settings: config?.settings ?? {},
    hooks: { ...(config?.hooks ?? {}) },
  });

  const loadHooks = async (hookTypes?: readonly HookType[]) => {
    setLoading(true);
    const typesToLoad = hookTypes || availableHookTypes;

    try {
      const config = ensureConfig(
        await AgentConfigurationService.readAgentSettings(agentType),
      );
      const newHooksData: Record<string, Hook[]> = {};

      // Load hooks for all available hook types
      // The main process now normalizes the hooks format for all agents
      if (config.hooks) {
        for (const hookType of typesToLoad) {
          if (config.hooks[hookType]) {
            newHooksData[hookType] = config.hooks[hookType];
          } else {
            newHooksData[hookType] = [];
          }
        }
      } else {
        // Initialize empty arrays for all hook types
        for (const hookType of typesToLoad) {
          newHooksData[hookType] = [];
        }
      }

      setHooksData(newHooksData);
    } catch (error) {
      console.error('Failed to load hooks:', error);
      // Initialize empty arrays for all hook types on error
      const emptyHooksData: Record<string, Hook[]> = {};
      for (const hookType of typesToLoad) {
        emptyHooksData[hookType] = [];
      }
      setHooksData(emptyHooksData);
    } finally {
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
  const saveHooks = async (updatedHooks: Hook[], hookType: HookType) => {
    try {
      const currentConfig = ensureConfig(
        await AgentConfigurationService.readAgentSettings(agentType),
      );

      const nextConfig: AgentSettings = {
        ...currentConfig,
        hooks: {
          ...currentConfig.hooks,
          [hookType]: updatedHooks,
        },
      };

      const success = await AgentConfigurationService.updateAgentSettings(
        agentType,
        nextConfig,
      );
      if (success) {
        setHooksData((prev) => ({
          ...prev,
          [hookType]: updatedHooks,
        }));
        onHooksChange?.();
      }
    } catch (error) {
      console.error('Failed to save hooks:', error);
    }
  };

  const handleAddHook = async () => {
    if (!newCommand.trim() || !selectedHookType) return;

    const currentHooksList = hooksData[selectedHookType] || [];

    const newHook: Hook = {
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

  const handleUpdateHook = async (
    oldMatcher: string,
    oldCommand: string,
    newMatcher: string,
    newCommand: string,
  ) => {
    if (!editingHook) return;

    const currentHooksList = hooksData[editingHook.hookType] || [];
    const hookIndex = currentHooksList.findIndex(
      (h) =>
        h.matcher === oldMatcher &&
        h.hooks.some((hk) => hk.command === oldCommand),
    );

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

  const handleRemoveHook = async (matcher: string, command: string) => {
    if (!selectedHookType) return;

    const currentHooksList = hooksData[selectedHookType] || [];
    const updatedHooks = currentHooksList.filter(
      (h) =>
        !(
          h.matcher === matcher && h.hooks.some((hk) => hk.command === command)
        ),
    );
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
      const config = ensureConfig(
        await AgentConfigurationService.readAgentSettings(agentType),
      );
      const hookPaths =
        await AgentConfigurationService.getAgentHooksFilePath(agentType);

      // Configure hooks for all available types
      const updatedHooks: Record<string, Hook[]> = {
        ...config.hooks,
      };
      for (const hookType of availableHookTypes) {
        if (!updatedHooks[hookType] || updatedHooks[hookType].length === 0) {
          updatedHooks[hookType] = [
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

      const nextConfig: AgentSettings = {
        ...config,
        hooks: updatedHooks,
      };

      const success = await AgentConfigurationService.updateAgentSettings(
        agentType,
        nextConfig,
      );
      if (success) {
        await loadHooks();
        // Trigger the parent component to refresh agent status
        onHooksChange?.();
      }
    } catch (error) {
      console.error('Failed to auto-configure hooks:', error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div style={{ color: theme.colors.textSecondary }}>
          Loading hooks...
        </div>
      </div>
    );
  }

  // Count configured hooks for each type
  const hookCounts: Record<string, number> = {};
  for (const hookType of availableHookTypes) {
    const typeHooks = hooksData[hookType] || [];
    hookCounts[hookType] = typeHooks.reduce(
      (sum, hook) => sum + hook.hooks.length,
      0,
    );
  }

  const totalHookCount = Object.values(hookCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  // If no hook type selected, show the overview
  if (!selectedHookType) {
    const gridCols =
      availableHookTypes.length <= 2
        ? 'grid-cols-2'
        : availableHookTypes.length <= 3
          ? 'grid-cols-3'
          : 'grid-cols-2 lg:grid-cols-3';

    return (
      <div className="space-y-4">
        <div className={`grid ${gridCols} gap-4`}>
          {availableHookTypes.map((hookType) => (
            <HookTypeCard
              key={hookType}
              type={getHookTypeDisplayName(hookType)}
              count={hookCounts[hookType]}
              configured={hookCounts[hookType] > 0}
              color={color}
              onClick={() => setSelectedHookType(hookType)}
              description={getHookTypeDescription(hookType)}
            />
          ))}
        </div>

        {/* Quick setup button */}
        {totalHookCount < availableHookTypes.length && (
          <div className="mt-6 text-center">
            <button
              onClick={async () => {
                await autoConfigureHooks();
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Quick Setup All Hook Types
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show detailed view for selected hook type
  const currentHooks = hooksData[selectedHookType] || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => setSelectedHookType(null)}
        className="flex items-center gap-2 text-sm transition-colors"
        style={{
          color: hoveredElements['back-button']
            ? theme.colors.text
            : theme.colors.textSecondary,
        }}
        onMouseEnter={() =>
          setHoveredElements((prev) => ({ ...prev, 'back-button': true }))
        }
        onMouseLeave={() =>
          setHoveredElements((prev) => ({ ...prev, 'back-button': false }))
        }
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Hook Types
      </button>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {getHookTypeDisplayName(selectedHookType)} Hooks
        </h3>
        {currentHooks.length > 0 && (
          <button
            onClick={async () => {
              const confirmed = window.confirm(
                `Are you sure you want to remove all ${selectedHookType} hooks? This action cannot be undone.`,
              );
              if (confirmed) {
                await saveHooks([], selectedHookType);
              }
            }}
            className="px-3 py-1.5 text-xs text-red-400 rounded-md transition-colors flex items-center gap-2"
            style={{
              backgroundColor: hoveredElements['clear-all']
                ? 'rgba(220, 38, 38, 0.3)'
                : 'rgba(220, 38, 38, 0.2)',
            }}
            onMouseEnter={() =>
              setHoveredElements((prev) => ({ ...prev, 'clear-all': true }))
            }
            onMouseLeave={() =>
              setHoveredElements((prev) => ({ ...prev, 'clear-all': false }))
            }
            title="Remove all hooks"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear All
          </button>
        )}
      </div>

      {currentHooks.length === 0 && !showAddForm && (
        <div
          className="text-center py-16 rounded-lg"
          style={{ backgroundColor: `${theme.colors.surface}80` }}
        >
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${theme.colors.backgroundTertiary}80` }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: theme.colors.textSecondary }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <p className="mb-4" style={{ color: theme.colors.textSecondary }}>
            No hooks configured yet
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-white rounded-md text-sm transition-colors"
            style={{
              backgroundColor: hoveredElements['add-first-hook']
                ? theme.colors.textMuted
                : theme.colors.backgroundTertiary,
            }}
            onMouseEnter={() =>
              setHoveredElements((prev) => ({
                ...prev,
                'add-first-hook': true,
              }))
            }
            onMouseLeave={() =>
              setHoveredElements((prev) => ({
                ...prev,
                'add-first-hook': false,
              }))
            }
          >
            Add Your First Hook
          </button>
        </div>
      )}

      {/* Add/Edit form */}
      {(showAddForm || editingHook) && (
        <div
          className="rounded-lg p-6 space-y-4"
          style={{ backgroundColor: theme.colors.surface }}
        >
          <h4
            className="font-medium text-lg mb-4"
            style={{ color: theme.colors.text }}
          >
            {editingHook ? 'Configure Hook' : 'Add New Hook'}
          </h4>

          {/* Hook Details Section */}
          <div className="space-y-4">
            {hookTypeUsesMatchers(selectedHookType) && (
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme.colors.textTertiary }}
                >
                  Matcher Pattern
                </label>
                <input
                  type="text"
                  value={editingHook ? editingHook.matcher : newMatcher}
                  onChange={(e) => {
                    if (editingHook) {
                      setEditingHook({
                        ...editingHook,
                        matcher: e.target.value,
                      });
                    } else {
                      setNewMatcher(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., * for all tools or specific tool name"
                  style={{
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                  }}
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: theme.colors.textMuted }}
                >
                  Use * to match all tools, or specify tool names like "Edit",
                  "Read", "Bash"
                </p>
              </div>
            )}

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: theme.colors.textTertiary }}
              >
                Hook Script Path
              </label>
              <input
                type="text"
                value={editingHook ? editingHook.command : newCommand}
                onChange={(e) => {
                  if (editingHook) {
                    setEditingHook({ ...editingHook, command: e.target.value });
                  } else {
                    setNewCommand(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., ~/code-city/hooks/my-hook.sh"
                style={{
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                }}
              />
              <p
                className="text-xs mt-1"
                style={{ color: theme.colors.textMuted }}
              >
                Full path to the executable script that will run when the hook
                is triggered
              </p>
            </div>
          </div>

          <div
            className="flex gap-2 justify-end pt-4 border-t"
            style={{ borderColor: theme.colors.border }}
          >
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingHook(null);
                setNewMatcher(getDefaultMatcher(selectedHookType));
                setNewCommand('');
              }}
              className="px-4 py-2 text-sm text-white rounded transition-colors"
              style={{
                backgroundColor: hoveredElements['cancel-button']
                  ? theme.colors.textMuted
                  : theme.colors.backgroundTertiary,
              }}
              onMouseEnter={() =>
                setHoveredElements((prev) => ({
                  ...prev,
                  'cancel-button': true,
                }))
              }
              onMouseLeave={() =>
                setHoveredElements((prev) => ({
                  ...prev,
                  'cancel-button': false,
                }))
              }
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (editingHook) {
                  const currentHooksList =
                    hooksData[editingHook.hookType] || [];
                  const originalHook = currentHooksList[editingHook.index];
                  handleUpdateHook(
                    originalHook.matcher || '',
                    originalHook.hooks[0]?.command || '',
                    editingHook.matcher,
                    editingHook.command,
                  );
                } else {
                  handleAddHook();
                }
              }}
              disabled={
                editingHook ? !editingHook.command.trim() : !newCommand.trim()
              }
              className="px-4 py-2 text-sm text-white rounded transition-colors"
              style={{
                backgroundColor: (
                  editingHook ? editingHook.command.trim() : newCommand.trim()
                )
                  ? hoveredElements['save-button']
                    ? '#1d4ed8'
                    : '#2563eb'
                  : theme.colors.backgroundTertiary,
                cursor: (
                  editingHook ? editingHook.command.trim() : newCommand.trim()
                )
                  ? 'pointer'
                  : 'not-allowed',
              }}
              onMouseEnter={() => {
                if (
                  editingHook ? editingHook.command.trim() : newCommand.trim()
                ) {
                  setHoveredElements((prev) => ({
                    ...prev,
                    'save-button': true,
                  }));
                }
              }}
              onMouseLeave={() =>
                setHoveredElements((prev) => ({
                  ...prev,
                  'save-button': false,
                }))
              }
            >
              {editingHook ? 'Save Configuration' : 'Add Hook'}
            </button>
          </div>
        </div>
      )}

      {/* All hooks - grid or list layout */}
      <div
        className={layout === 'grid' ? 'grid grid-cols-4 gap-3' : 'space-y-2'}
      >
        {currentHooks.map((hook, index) =>
          hook.hooks.map((h, _hIndex) => (
            <HookSquare
              key={`${hook.matcher || 'all'}-${h.command}`}
              command={h.command}
              matcher={hook.matcher || 'all'}
              color={color}
              layout={layout}
              onEdit={() => {
                setSelectedHookType(selectedHookType);
                setEditingHook({
                  matcher: hook.matcher || '',
                  command: h.command,
                  index,
                  hookType: selectedHookType,
                });
              }}
              onRemove={() => handleRemoveHook(hook.matcher || '', h.command)}
              onShowInfo={() =>
                setInfoHook({
                  matcher: hook.matcher || 'all',
                  command: h.command,
                })
              }
            />
          )),
        )}

        {/* Add hook button */}
        {!showAddForm && !editingHook && (
          <button
            onClick={() => setShowAddForm(true)}
            className={`${
              layout === 'grid'
                ? 'border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center transition-all group'
                : 'w-full border-2 border-dashed rounded-lg px-4 py-3 flex items-center justify-center transition-all group'
            }`}
            style={{
              backgroundColor: hoveredElements['add-hook-button']
                ? theme.colors.surface
                : `${theme.colors.surface}80`,
              borderColor: hoveredElements['add-hook-button']
                ? theme.colors.textMuted
                : theme.colors.border,
            }}
            onMouseEnter={() =>
              setHoveredElements((prev) => ({
                ...prev,
                'add-hook-button': true,
              }))
            }
            onMouseLeave={() =>
              setHoveredElements((prev) => ({
                ...prev,
                'add-hook-button': false,
              }))
            }
          >
            <svg
              className={`${layout === 'grid' ? 'w-8 h-8 mb-1' : 'w-5 h-5 mr-2'}`}
              style={{
                color: hoveredElements['add-hook-button']
                  ? theme.colors.textTertiary
                  : theme.colors.textMuted,
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <p
              className={`text-${layout === 'grid' ? 'xs' : 'sm'}`}
              style={{
                color: hoveredElements['add-hook-button']
                  ? theme.colors.textTertiary
                  : theme.colors.textMuted,
              }}
            >
              Add Hook
            </p>
          </button>
        )}
      </div>

      {/* Info Modal */}
      {infoHook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-lg p-6 max-w-md w-full"
            style={{ backgroundColor: theme.colors.background }}
          >
            <h3 className="text-lg font-semibold mb-4">Hook Details</h3>

            <div className="space-y-3 text-sm">
              <div>
                <span style={{ color: theme.colors.textSecondary }}>
                  Hook Name:
                </span>
                <span className="ml-2" style={{ color: theme.colors.text }}>
                  {infoHook.command.split('/').pop() || infoHook.command}
                </span>
              </div>

              <div>
                <span style={{ color: theme.colors.textSecondary }}>
                  Matcher Pattern:
                </span>
                <code
                  className="ml-2 px-2 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                  }}
                >
                  {infoHook.matcher}
                </code>
              </div>

              <div>
                <span style={{ color: theme.colors.textSecondary }}>
                  Full Path:
                </span>
                <div className="mt-1">
                  <code
                    className="px-2 py-1 rounded text-xs break-all block"
                    style={{
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text,
                    }}
                  >
                    {infoHook.command}
                  </code>
                </div>
              </div>

              <div
                className="mt-2 text-xs"
                style={{ color: theme.colors.textMuted }}
              >
                This hook will run when tools matching "{infoHook.matcher}" are
                used.
              </div>
            </div>

            <button
              onClick={() => setInfoHook(null)}
              className="mt-6 w-full px-4 py-2 text-white rounded-md transition-colors"
              style={{
                backgroundColor: hoveredElements['close-modal']
                  ? theme.colors.backgroundTertiary
                  : theme.colors.surface,
              }}
              onMouseEnter={() =>
                setHoveredElements((prev) => ({ ...prev, 'close-modal': true }))
              }
              onMouseLeave={() =>
                setHoveredElements((prev) => ({
                  ...prev,
                  'close-modal': false,
                }))
              }
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

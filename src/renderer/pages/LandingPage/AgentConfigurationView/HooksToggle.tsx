import React, { useState, useCallback } from 'react';
import { ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';

import {
  getAgentInfo,
  type SupportedAgent,
} from '@principal-ai/agent-monitoring';
import { useTheme } from 'themed-markdown';

import { AgentConfigurationService } from '../../../main-process-api/AgentConfigurationService';

interface HooksToggleProps {
  agentType: SupportedAgent;
  hooksEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

export const HooksToggle: React.FC<HooksToggleProps> = ({
  agentType,
  onToggle,
  hooksEnabled,
  className = '',
}) => {
  const { theme } = useTheme();
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  console.log('HooksToggle', agentType, hooksEnabled);

  const handleToggle = useCallback(async () => {
    setIsToggling(true);

    try {
      let success = false;
      console.log('handleToggle', agentType, hooksEnabled);

      if (hooksEnabled) {
        // Disable hooks - save current hooks configuration first

        // Use the proper IPC handler to remove all hooks
        const result =
          await AgentConfigurationService.removeHooksFromAgent(agentType);
        success = result;
      } else {
        // Enable hooks - use the proper IPC handler to add hooks
        const result =
          await AgentConfigurationService.addHooksToAgent(agentType);
        success = result;
      }

      if (success) {
        onToggle(!hooksEnabled);
        setError(null);
      } else {
        // Check if this is an OpenCode plugin system error
        if (agentType === 'opencode' && !hooksEnabled) {
          setError('OpenCode uses a plugin system. Hooks are not supported.');
        } else {
          setError('Failed to toggle hooks. Please try again.');
        }
      }
    } catch (error) {
      console.error('Failed to toggle hooks:', error);
      setError('An unexpected error occurred.');
    } finally {
      setIsToggling(false);
    }
  }, [agentType, hooksEnabled, onToggle]);

  const agentInfo = getAgentInfo(agentType as SupportedAgent);

  // Disable toggle for OpenCode
  const isOpenCode = agentType === 'opencode';
  const isDisabled = isToggling || isOpenCode;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={isDisabled}
          className={`relative inline-flex items-center h-8 w-14 rounded-full transition-colors ${
            isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          style={{
            backgroundColor:
              hooksEnabled && !isOpenCode ? agentInfo.ui.color : '#64748b',
          }}
          title={
            isOpenCode
              ? 'OpenCode uses a plugin system'
              : hooksEnabled
                ? 'Disable all hooks'
                : 'Enable hooks'
          }
        >
          <span
            className={`
            inline-block h-6 w-6 transform rounded-full bg-white transition-transform
            ${hooksEnabled ? 'translate-x-7' : 'translate-x-1'}
          `}
          >
            {hooksEnabled ? (
              <ToggleRight size={24} style={{ color: agentInfo.ui.color }} />
            ) : (
              <ToggleLeft
                size={24}
                style={{ color: theme.colors.textSecondary }}
              />
            )}
          </span>
        </button>

        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {isOpenCode
              ? 'Plugin System'
              : `Hooks ${hooksEnabled ? 'Enabled' : 'Disabled'}`}
          </span>
          {isToggling && (
            <span
              className="text-xs"
              style={{ color: theme.colors.textSecondary }}
            >
              {hooksEnabled ? 'Disabling...' : 'Enabling...'}
            </span>
          )}
          {isOpenCode && (
            <span
              className="text-xs"
              style={{ color: theme.colors.textSecondary }}
            >
              Use OpenCode plugins instead
            </span>
          )}
        </div>
      </div>
      {error && (
        <div className="text-xs text-red-500 flex items-center gap-1 ml-1">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
};

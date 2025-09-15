import React, { useState, useCallback } from 'react';
import { ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';

import { getAgentInfo, type SupportedAgent } from "@principal-ai/agent-monitoring";
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
  console.log('HooksToggle', agentType, hooksEnabled);



  const handleToggle = useCallback(async () => {
    setIsToggling(true);

    try {
      let success = false;
      console.log('handleToggle', agentType, hooksEnabled);

      if (hooksEnabled) {
        // Disable hooks - save current hooks configuration first

        // Use the proper IPC handler to remove all hooks
        const result = await AgentConfigurationService.removeHooksFromAgent(
          agentType
        );
        success = result;
      } else {
        // Enable hooks - use the proper IPC handler to add hooks
        const result = await AgentConfigurationService.addHooksToAgent(
          agentType
        );
        success = result;
      }

      onToggle(!hooksEnabled);
    } catch (error) {
      console.error('Failed to toggle hooks:', error);
    } finally {
      setIsToggling(false);
    }
  }, [agentType, hooksEnabled, onToggle]);

  const agentInfo = getAgentInfo(agentType as SupportedAgent);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        onClick={handleToggle}
        disabled={isToggling}
        className={`relative inline-flex items-center h-8 w-14 rounded-full transition-colors ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          backgroundColor: hooksEnabled ? agentInfo.ui.color : '#64748b',
        }}
        title={hooksEnabled ? 'Disable all hooks' : 'Enable hooks'}
      >
        <span
          className={`
            inline-block h-6 w-6 transform rounded-full bg-white transition-transform
            ${hooksEnabled ? 'translate-x-7' : 'translate-x-1'}
          `}
        >
          {hooksEnabled ? (
            <ToggleRight
              size={24}
              style={{ color: agentInfo.ui.color }}
            />
          ) : (
            <ToggleLeft size={24} style={{ color: theme.colors.textSecondary }} />
          )}
        </span>
      </button>

      <div className="flex flex-col">
        <span className="text-sm font-medium">
          Hooks {hooksEnabled ? 'Enabled' : 'Disabled'}
        </span>
        {isToggling && (
          <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
            {hooksEnabled ? 'Disabling...' : 'Enabling...'}
          </span>
        )}
      </div>
    </div>
  );
};

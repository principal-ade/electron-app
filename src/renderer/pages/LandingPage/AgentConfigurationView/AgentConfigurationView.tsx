import React from 'react';

import { SupportedAgent } from '@principal-ai/agent-monitoring';

import { AgentSetupStatus } from '../../../../shared/main-process-api-interfaces/AgentConfigAPI';

import { AgentSetupWizard } from './AgentSetupWizard';
import { DetailedConfigurationView } from './DetailedConfigurationView';

interface AgentConfigurationViewProps {
  agentType: SupportedAgent;
  agentStatus: AgentSetupStatus;
  checkAgentStatus: () => Promise<void>;
  viewLayout?: 'simple' | 'detailed';
  onShowDetails?: () => void;
  onBackToSetup?: () => void;
  onBackToAssistants?: () => void;
}

export const AgentConfigurationView: React.FC<AgentConfigurationViewProps> = ({
  agentType,
  agentStatus,
  checkAgentStatus,
  viewLayout = 'simple',
  onShowDetails,
  onBackToSetup,
  onBackToAssistants,
}) => {
  // Simple view
  if (viewLayout === 'simple') {
    return (
      <AgentSetupWizard
        agentType={agentType}
        agentStatus={agentStatus}
        checkAgentStatus={checkAgentStatus}
        onShowDetails={onShowDetails || (() => {})}
        onBackToAssistants={onBackToAssistants}
      />
    );
  }

  // Detailed view
  return (
    <DetailedConfigurationView
      agentType={agentType}
      initialAgentStatus={agentStatus}
      checkAgentStatus={checkAgentStatus}
      onBackToSetup={onBackToSetup}
    />
  );
};

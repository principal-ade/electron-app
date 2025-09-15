import { jsx as _jsx } from "react/jsx-runtime";
import { AgentSetupWizard } from './AgentSetupWizard';
import { DetailedConfigurationView } from './DetailedConfigurationView';
export const AgentConfigurationView = ({ agentType, agentStatus, checkAgentStatus, viewLayout = 'simple', onShowDetails, onBackToSetup, handleClaudeTourNext, handleClaudeTourAction, handleClaudeTourButtonClick, isClaudeTourActive, claudeTourStepIndex, }) => {
    // Simple view
    if (viewLayout === 'simple') {
        return (_jsx(AgentSetupWizard, { agentType: agentType, agentStatus: agentStatus, checkAgentStatus: checkAgentStatus, onShowDetails: onShowDetails || (() => { }), handleClaudeTourNext: handleClaudeTourNext, handleClaudeTourAction: handleClaudeTourAction, handleClaudeTourButtonClick: handleClaudeTourButtonClick, isClaudeTourActive: isClaudeTourActive, claudeTourStepIndex: claudeTourStepIndex }));
    }
    // Detailed view
    return (_jsx(DetailedConfigurationView, { agentType: agentType, initialAgentStatus: agentStatus, checkAgentStatus: checkAgentStatus, onBackToSetup: onBackToSetup }));
};

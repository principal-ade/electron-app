import React from 'react';
import { AgentInstallationStatus } from '../../main-process-api/AgentConfigurationService';
interface LandingPageProps {
    initialAgentStatus: AgentInstallationStatus;
    onUpdateAvailable?: (hasUpdate: boolean) => void;
}
export declare const LandingPage: React.FC<LandingPageProps>;
export {};
//# sourceMappingURL=LandingPage.d.ts.map
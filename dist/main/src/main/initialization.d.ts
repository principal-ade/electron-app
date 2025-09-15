import { ElectronMCPIntegration } from './mcp-app-control/mcp-integration';
import { AgentSessionEventsHttpBridge } from './agent-session-events/AgentSessionEventsHttpBridge';
declare let mcpIntegration: ElectronMCPIntegration | null;
declare let agentSessionEventsHttpBridge: AgentSessionEventsHttpBridge | null;
export declare const initializeServices: () => Promise<void>;
export declare const shutdownServices: () => Promise<void>;
export { mcpIntegration, agentSessionEventsHttpBridge };
//# sourceMappingURL=initialization.d.ts.map
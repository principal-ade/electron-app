export { type AgentSessionEvent, AgentSessionEventsAPIEvent, type AgentSessionEventsAPI } from '../main-process-api-interfaces/AgentSessionEventsAPI';
import { McpToolsAPI } from '../main-process-api-interfaces/McpToolsAPI';
import { PackageManagerAPI } from '../main-process-api-interfaces/PackageManagerAPI';
import { TypeSchemaAPI } from '../main-process-api-interfaces/TypeSchemaAPI';
import { TypeExtractionAPI } from '../main-process-api-interfaces/TypeExtractionAPI';
export interface ElectronAPI {
    typeExtraction: TypeExtractionAPI;
    typeSchema: TypeSchemaAPI;
    packageManager: PackageManagerAPI;
    mcpTools: McpToolsAPI;
    ipcRenderer: {
        sendMessage: (channel: string, ...args: unknown[]) => void;
        send: (channel: string, ...args: unknown[]) => void;
        on: (channel: string, func: (...args: unknown[]) => void) => () => void;
        once: (channel: string, func: (...args: unknown[]) => void) => void;
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        removeAllListeners: (channel: string) => void;
        removeListener: (channel: string, func: (...args: unknown[]) => void) => void;
    };
    getResolvedMcpScriptPath: () => Promise<string>;
    restartApp: () => void;
}
//# sourceMappingURL=index.d.ts.map
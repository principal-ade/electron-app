import { z } from 'zod';
import { McpToolResult } from '../types';
import { BaseTool } from './base-tool';
export interface AgentHandoffData {
    context: string;
}
export interface AgentHandoffResult {
    success: boolean;
    handoffId: string;
    timestamp: string;
    message?: string;
}
export declare class AgentHandoffTool extends BaseTool<AgentHandoffData, AgentHandoffResult> {
    name: string;
    description: string;
    schema: z.ZodType<AgentHandoffData>;
    execute(params: AgentHandoffData): Promise<McpToolResult<AgentHandoffResult>>;
    private makeHttpRequest;
}
//# sourceMappingURL=AgentHandoffTool.d.ts.map
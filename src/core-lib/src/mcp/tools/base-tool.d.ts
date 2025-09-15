/**
 * Base Tool Class
 * Abstract base class for all MCP tools
 */
import { z } from 'zod';
import { McpTool, McpToolResult, JsonSchema } from '../types';
export declare abstract class BaseTool<TParams = unknown, TResult = unknown> implements McpTool<TParams, TResult> {
    abstract name: string;
    abstract description: string;
    abstract schema: z.ZodType<TParams, z.ZodTypeDef, TParams>;
    get inputSchema(): JsonSchema;
    abstract execute(params: TParams): Promise<McpToolResult<TResult>>;
    handler(params: TParams): Promise<McpToolResult<TResult>>;
    protected createSuccessResponse(text: string, data?: TResult): McpToolResult<TResult>;
    protected createErrorResponse(message: string): McpToolResult<TResult>;
}
//# sourceMappingURL=base-tool.d.ts.map
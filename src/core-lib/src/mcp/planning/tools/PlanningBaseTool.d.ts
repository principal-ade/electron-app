import { BaseTool } from '../../tools/base-tool';
type PlanningRequestData = Record<string, unknown>;
interface PlanningSuccessResponse {
    success: true;
    [key: string]: unknown;
}
interface PlanningErrorResponse {
    success: false;
    error: string;
}
type PlanningResponseData = PlanningSuccessResponse | PlanningErrorResponse;
/**
 * Base class for Planning MCP tools
 * Provides shared HTTP request functionality for communicating with the Planning MCP Bridge
 */
export declare abstract class PlanningBaseTool<TParams = unknown, TResult = unknown> extends BaseTool<TParams, TResult> {
    protected makeRequest(path: string, data: PlanningRequestData): Promise<PlanningResponseData>;
}
export {};
//# sourceMappingURL=PlanningBaseTool.d.ts.map
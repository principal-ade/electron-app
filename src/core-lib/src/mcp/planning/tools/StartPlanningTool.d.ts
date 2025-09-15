import { z } from 'zod';
import { McpToolResult } from '../../types';
import { PlanningBaseTool } from './PlanningBaseTool';
export declare class StartPlanningTool extends PlanningBaseTool {
    name: string;
    description: string;
    schema: z.ZodObject<{
        agentName: z.ZodString;
        suggestedTitle: z.ZodOptional<z.ZodString>;
        suggestedType: z.ZodOptional<z.ZodEnum<["markdown", "excalidraw"]>>;
        message: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        agentName: string;
        message?: string | undefined;
        suggestedTitle?: string | undefined;
        suggestedType?: "markdown" | "excalidraw" | undefined;
    }, {
        agentName: string;
        message?: string | undefined;
        suggestedTitle?: string | undefined;
        suggestedType?: "markdown" | "excalidraw" | undefined;
    }>;
    execute(input: z.infer<typeof this.schema>): Promise<McpToolResult>;
}
//# sourceMappingURL=StartPlanningTool.d.ts.map
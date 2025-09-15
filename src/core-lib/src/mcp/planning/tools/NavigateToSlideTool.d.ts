import { z } from 'zod';
import { McpToolResult } from '../../types';
import { PlanningBaseTool } from './PlanningBaseTool';
export declare class NavigateToSlideTool extends PlanningBaseTool {
    name: string;
    description: string;
    schema: z.ZodObject<{
        filePath: z.ZodString;
        slideNumber: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        filePath: string;
        slideNumber: number;
    }, {
        filePath: string;
        slideNumber: number;
    }>;
    execute(input: z.infer<typeof this.schema>): Promise<McpToolResult>;
}
//# sourceMappingURL=NavigateToSlideTool.d.ts.map
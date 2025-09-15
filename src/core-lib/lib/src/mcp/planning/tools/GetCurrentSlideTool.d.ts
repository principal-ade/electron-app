import { z } from 'zod';
import { McpToolResult } from '../../types';
import { PlanningBaseTool } from './PlanningBaseTool';
export declare class GetCurrentSlideTool extends PlanningBaseTool {
    name: string;
    description: string;
    schema: z.ZodObject<{
        filePath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        filePath: string;
    }, {
        filePath: string;
    }>;
    execute(input: z.infer<typeof this.schema>): Promise<McpToolResult>;
}
//# sourceMappingURL=GetCurrentSlideTool.d.ts.map
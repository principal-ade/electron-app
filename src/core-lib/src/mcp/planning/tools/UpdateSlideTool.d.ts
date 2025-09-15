import { z } from 'zod';
import { McpToolResult } from '../../types';
import { PlanningBaseTool } from './PlanningBaseTool';
export declare class UpdateSlideTool extends PlanningBaseTool {
    name: string;
    description: string;
    schema: z.ZodObject<{
        filePath: z.ZodString;
        slideNumber: z.ZodNumber;
        content: z.ZodString;
        autoSave: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        filePath: string;
        slideNumber: number;
        autoSave: boolean;
    }, {
        content: string;
        filePath: string;
        slideNumber: number;
        autoSave?: boolean | undefined;
    }>;
    execute(input: z.infer<typeof this.schema>): Promise<McpToolResult>;
}
//# sourceMappingURL=UpdateSlideTool.d.ts.map
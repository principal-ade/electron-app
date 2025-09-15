import { z } from 'zod';
import { McpToolResult } from '../../types';
import { PlanningBaseTool } from './PlanningBaseTool';
export declare class CreateSlideTool extends PlanningBaseTool {
    name: string;
    description: string;
    schema: z.ZodObject<{
        filePath: z.ZodString;
        position: z.ZodEnum<["before", "after", "end"]>;
        content: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        autoSave: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        position: "end" | "before" | "after";
        filePath: string;
        autoSave: boolean;
    }, {
        position: "end" | "before" | "after";
        filePath: string;
        content?: string | undefined;
        autoSave?: boolean | undefined;
    }>;
    execute(input: z.infer<typeof this.schema>): Promise<McpToolResult>;
}
//# sourceMappingURL=CreateSlideTool.d.ts.map
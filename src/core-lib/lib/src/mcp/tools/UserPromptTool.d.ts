import { z } from 'zod';
import { McpToolResult } from '../types';
import { BaseTool } from './base-tool';
/**
 * UserPromptTool - MCP tool for requesting user input
 *
 * This tool allows MCP servers to show prompts to users and get their responses.
 * It communicates with the Electron app via the MCP HTTP Bridge.
 */
export declare class UserPromptTool extends BaseTool {
    name: string;
    description: string;
    schema: z.ZodObject<{
        filePath: z.ZodString;
        message: z.ZodString;
        title: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["text", "confirm", "select", "multiline"]>>>;
        options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        defaultValue: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodBoolean]>>;
        placeholder: z.ZodOptional<z.ZodString>;
        required: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        timeout: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        title: string;
        type: "text" | "confirm" | "select" | "multiline";
        filePath: string;
        required: boolean;
        timeout?: number | undefined;
        options?: string[] | undefined;
        defaultValue?: string | boolean | undefined;
        placeholder?: string | undefined;
    }, {
        message: string;
        filePath: string;
        timeout?: number | undefined;
        title?: string | undefined;
        type?: "text" | "confirm" | "select" | "multiline" | undefined;
        options?: string[] | undefined;
        required?: boolean | undefined;
        defaultValue?: string | boolean | undefined;
        placeholder?: string | undefined;
    }>;
    execute(input: z.infer<typeof this.schema>): Promise<McpToolResult>;
}
//# sourceMappingURL=UserPromptTool.d.ts.map
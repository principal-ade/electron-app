/**
 * Base Tool Class
 * Abstract base class for all MCP tools
 */
import { z } from 'zod';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
export class BaseTool {
    get inputSchema() {
        return zodToJsonSchema(this.schema);
    }
    async handler(params) {
        try {
            // Validate params
            const validatedParams = this.schema.parse(params);
            // Execute tool logic
            return await this.execute(validatedParams);
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
                        },
                    ],
                    isError: true,
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    },
                ],
                isError: true,
            };
        }
    }
    createSuccessResponse(text, data) {
        return {
            content: [
                {
                    type: 'text',
                    text,
                    data,
                },
            ],
        };
    }
    createErrorResponse(message) {
        return {
            content: [
                {
                    type: 'text',
                    text: message,
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=base-tool.js.map
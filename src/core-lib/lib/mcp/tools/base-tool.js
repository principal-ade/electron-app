"use strict";
/**
 * Base Tool Class
 * Abstract base class for all MCP tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTool = void 0;
const zod_1 = require("zod");
const zod_to_json_schema_1 = require("../utils/zod-to-json-schema");
class BaseTool {
    get inputSchema() {
        return (0, zod_to_json_schema_1.zodToJsonSchema)(this.schema);
    }
    async handler(params) {
        try {
            // Validate params
            const validatedParams = this.schema.parse(params);
            // Execute tool logic
            return await this.execute(validatedParams);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
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
exports.BaseTool = BaseTool;

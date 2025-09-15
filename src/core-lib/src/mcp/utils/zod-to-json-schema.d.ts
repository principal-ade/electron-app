/**
 * Utility to convert Zod schemas to JSON Schema format
 * Used for MCP tool input schema definitions
 */
import { ZodTypeAny } from 'zod';
import { JsonSchema } from '../types/mcp-types';
export declare function zodToJsonSchema(schema: ZodTypeAny): JsonSchema;
//# sourceMappingURL=zod-to-json-schema.d.ts.map
/**
 * Utility to convert Zod schemas to JSON Schema format
 * Used for MCP tool input schema definitions
 */
function getDescription(def) {
    if (def && typeof def === 'object' && 'description' in def) {
        const desc = def.description;
        return typeof desc === 'string' ? desc : undefined;
    }
    return undefined;
}
export function zodToJsonSchema(schema) {
    const rawDef = schema._def;
    if (!rawDef) {
        return { type: 'object' };
    }
    const def = rawDef;
    const description = getDescription(def);
    const typeName = String(def.typeName);
    switch (typeName) {
        case 'ZodString': {
            return {
                type: 'string',
                ...(description ? { description } : {}),
            };
        }
        case 'ZodNumber': {
            return {
                type: 'number',
                ...(description ? { description } : {}),
            };
        }
        case 'ZodBoolean': {
            return {
                type: 'boolean',
                ...(description ? { description } : {}),
            };
        }
        case 'ZodArray': {
            const itemType = def.type;
            return {
                type: 'array',
                items: itemType ? zodToJsonSchema(itemType) : {},
                ...(description ? { description } : {}),
            };
        }
        case 'ZodObject': {
            const properties = {};
            const required = [];
            const shapeFn = def.shape;
            const shape = typeof shapeFn === 'function' ? shapeFn() : {};
            for (const [key, fieldSchema] of Object.entries(shape)) {
                const zodField = fieldSchema;
                properties[key] = zodToJsonSchema(zodField);
                const fieldDefUnknown = zodField._def;
                const fieldTypeName = String(fieldDefUnknown?.typeName);
                if (fieldTypeName !== 'ZodOptional' && fieldTypeName !== 'ZodDefault') {
                    required.push(key);
                }
            }
            return {
                type: 'object',
                properties,
                ...(required.length > 0 ? { required } : {}),
                ...(description ? { description } : {}),
            };
        }
        case 'ZodOptional': {
            const innerType = def.innerType;
            return innerType ? zodToJsonSchema(innerType) : {};
        }
        case 'ZodDefault': {
            const innerType = def.innerType;
            const defaultValueFn = def.defaultValue;
            const innerSchema = innerType ? zodToJsonSchema(innerType) : {};
            return {
                ...innerSchema,
                ...(typeof defaultValueFn === 'function' ? { default: defaultValueFn() } : {}),
            };
        }
        case 'ZodEnum': {
            const values = def.values;
            return {
                type: 'string',
                ...(Array.isArray(values) ? { enum: values } : {}),
                ...(description ? { description } : {}),
            };
        }
        case 'ZodUnion': {
            const options = def.options;
            return {
                oneOf: options ? options.map(opt => zodToJsonSchema(opt)) : [],
                ...(description ? { description } : {}),
            };
        }
        case 'ZodRecord': {
            return {
                type: 'object',
                additionalProperties: true,
                ...(description ? { description } : {}),
            };
        }
        default: {
            return { type: 'object' };
        }
    }
}

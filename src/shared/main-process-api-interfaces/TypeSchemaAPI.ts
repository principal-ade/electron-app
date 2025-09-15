export enum TypeSchemaAPIEvent {
  GENERATE_SCHEMAS = 'type-schema:generate-schemas',
  EXTRACT_TYPES = 'type-schema:extract-types',
  VALIDATE_TYPE_EXISTS = 'type-schema:validate-type-exists',
  GENERATE_DECLARATIONS = 'type-schema:generate-declarations',
}

export interface TypeSchemaGenerationOptions {
  filePaths: string[];
  tsConfigPath?: string;
  includeNodeModules?: boolean;
}

export interface TypeSchemaResult {
  filePath: string;
  typeName: string;
  schema: unknown; // JSON Schema can be any structure
}

export interface TypeSchemaError {
  filePath: string;
  error: string;
}

export interface TypeSchemaAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TypeSchemaAPI {
  generateSchemas: (
    options: TypeSchemaGenerationOptions
  ) => Promise<TypeSchemaAPIResponse<{
    schemas: TypeSchemaResult[];
    errors: TypeSchemaError[];
  }>>;
  
  extractTypes: (
    filePath: string,
    tsConfigPath?: string
  ) => Promise<TypeSchemaAPIResponse<string[]>>;
  
  validateTypeExists: (
    filePath: string,
    typeName: string,
    tsConfigPath?: string
  ) => Promise<TypeSchemaAPIResponse<boolean>>;
  
  generateDeclarations: (
    filePath: string,
    tsConfigPath?: string
  ) => Promise<TypeSchemaAPIResponse<{ declarations: string; exportedTypes: string[] }>>;
}
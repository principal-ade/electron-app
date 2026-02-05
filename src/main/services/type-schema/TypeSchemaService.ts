import * as tsj from 'ts-json-schema-generator';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import { Config } from 'ts-json-schema-generator/dist/src/Config';

// Named types for better readability of dynamic data
/** JSON Schema object generated from TypeScript types (unvalidated structure) */
type JSONSchema = unknown;

export interface TypeSchemaGenerationOptions {
  files: string[];
  typeNames?: string[];
  tsConfigPath?: string;
  additionalProperties?: boolean;
  strictTuples?: boolean;
  expose?: 'all' | 'none' | 'export';
  jsDoc?: 'none' | 'basic' | 'extended';
}

export interface TypeSchemaResult {
  fileName: string;
  typeName: string;
  schema: JSONSchema;
}

export interface TypeSchemaError {
  fileName: string;
  typeName?: string;
  error: string;
}

export class TypeSchemaService {
  private static instance: TypeSchemaService | null = null;

  private constructor() {}

  public static getInstance(): TypeSchemaService {
    if (!TypeSchemaService.instance) {
      TypeSchemaService.instance = new TypeSchemaService();
    }
    return TypeSchemaService.instance;
  }

  public async generateSchemasForLayer(
    options: TypeSchemaGenerationOptions,
  ): Promise<{
    schemas: TypeSchemaResult[];
    errors: TypeSchemaError[];
  }> {
    const schemas: TypeSchemaResult[] = [];
    const errors: TypeSchemaError[] = [];

    for (const file of options.files) {
      try {
        // Check if file exists
        await fs.access(file);

        // First, try to extract all available types
        let availableTypes: string[] = [];
        try {
          availableTypes = await this.extractTypesFromFile(
            file,
            options.tsConfigPath,
          );
          console.log(
            `Found ${availableTypes.length} types in ${file}:`,
            availableTypes,
          );
        } catch (extractError: unknown) {
          const errorMessage = extractError instanceof Error ? extractError.message : 'Unknown error';
          console.warn(
            `Could not extract types from ${file}:`,
            errorMessage,
          );
          // If we can't extract types, try with '*' anyway
          availableTypes = ['*'];
        }

        // If specific types requested, use those; otherwise use extracted types
        const typeNames =
          options.typeNames ||
          (availableTypes.length > 0 ? availableTypes : ['*']);

        for (const typeName of typeNames) {
          try {
            const schema = await this.generateSchemaForFile(
              file,
              typeName,
              options,
            );

            // If generating for all types (*), extract all defined types from schema
            if (typeName === '*' && schema.definitions) {
              for (const [definedType, definition] of Object.entries(
                schema.definitions,
              )) {
                schemas.push({
                  fileName: file,
                  typeName: definedType,
                  schema: definition,
                });
              }
            } else if (typeName !== '*') {
              schemas.push({
                fileName: file,
                typeName,
                schema,
              });
            }
          } catch (error: unknown) {
            console.error(
              `Error generating schema for type '${typeName}' in ${file}:`,
              error,
            );

            // Keep the original error message and add a simplified summary
            const originalError =
              error instanceof Error ? error.message : 'Unknown error generating schema';
            let errorSummary = '';

            // Determine error category
            if (
              originalError.includes('Unhandled error while creating Base Type')
            ) {
              errorSummary = 'Complex type structure not supported';
            } else if (originalError.includes('Cannot find module')) {
              const moduleMatch = originalError.match(
                /Cannot find module '([^']+)'/,
              );
              if (moduleMatch) {
                errorSummary = `Missing module: ${moduleMatch[1]}`;
              } else {
                errorSummary = 'Missing type definitions';
              }
            } else if (originalError.includes('Circular reference')) {
              errorSummary = 'Circular type reference';
            } else if (originalError.includes('Failed to generate schema')) {
              errorSummary = 'Schema generation failed';
            }

            // Store both the summary and original error
            errors.push({
              fileName: file,
              typeName,
              error: errorSummary
                ? `${errorSummary}\n\nOriginal error:\n${originalError}`
                : originalError,
            });
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          fileName: file,
          error: `File not accessible: ${errorMessage}`,
        });
      }
    }

    return { schemas, errors };
  }

  private async generateSchemaForFile(
    filePath: string,
    typeName: string,
    options: TypeSchemaGenerationOptions,
  ): Promise<JSONSchema> {
    // Try to find tsconfig.json if not provided
    let { tsConfigPath } = options;
    if (!tsConfigPath) {
      tsConfigPath = await this.findTsConfig(path.dirname(filePath));
    }

    const config: Config = {
      path: filePath,
      type: typeName,
      tsconfig: tsConfigPath,
      expose: options.expose || 'export',
      jsDoc: options.jsDoc || 'extended',
      additionalProperties: options.additionalProperties || false,
      strictTuples: options.strictTuples || false,
      skipTypeCheck: true, // For better performance
      encodeRefs: true,
      // Add more forgiving options
      topRef: false,
      discriminatorType: 'open-api',
    };

    try {
      const generator = tsj.createGenerator(config);
      const schema = generator.createSchema(config.type);
      return schema;
    } catch (error: unknown) {
      // Enhance error message with more context
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Schema generation error details:', {
        file: filePath,
        type: typeName,
        tsconfig: tsConfigPath,
        error: errorStack || errorMessage,
      });
      throw new Error(
        `Failed to generate schema for type '${typeName}' in file '${filePath}': ${errorMessage}`,
      );
    }
  }

  private async findTsConfig(startDir: string): Promise<string | undefined> {
    let currentDir = startDir;
    const { root } = path.parse(currentDir);

    while (currentDir !== root) {
      const tsConfigPath = path.join(currentDir, 'tsconfig.json');
      try {
        await fs.access(tsConfigPath);
        console.log('Found tsconfig.json at:', tsConfigPath);
        return tsConfigPath;
      } catch {
        // Continue searching
      }
      currentDir = path.dirname(currentDir);
    }

    console.warn('No tsconfig.json found in directory tree');
    return undefined;
  }

  public async extractTypesFromFile(
    filePath: string,
    tsConfigPath?: string,
  ): Promise<string[]> {
    try {
      // Find tsconfig if not provided
      if (!tsConfigPath) {
        tsConfigPath = await this.findTsConfig(path.dirname(filePath));
      }

      // Read the file content to parse exports manually as a fallback
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Try using the generator first
      try {
        const config: Config = {
          path: filePath,
          type: '*',
          tsconfig: tsConfigPath,
          expose: 'export',
          skipTypeCheck: true,
          topRef: false,
        };

        const generator = tsj.createGenerator(config);
        const schema = generator.createSchema(config.type);

        // Extract type names from definitions
        if (schema.definitions) {
          return Object.keys(schema.definitions);
        }
      } catch (generatorError: unknown) {
        const errorMessage = generatorError instanceof Error ? generatorError.message : 'Unknown error';
        console.warn(
          'Generator failed, trying manual extraction:',
          errorMessage,
        );
      }

      // Fallback: Try to extract exported types manually from the file
      const exportedTypes: string[] = [];

      // Match exported interfaces
      const interfaceMatches = fileContent.matchAll(
        /export\s+interface\s+(\w+)/g,
      );
      for (const match of interfaceMatches) {
        exportedTypes.push(match[1]);
      }

      // Match exported types
      const typeMatches = fileContent.matchAll(/export\s+type\s+(\w+)/g);
      for (const match of typeMatches) {
        exportedTypes.push(match[1]);
      }

      // Match exported classes
      const classMatches = fileContent.matchAll(/export\s+class\s+(\w+)/g);
      for (const match of classMatches) {
        exportedTypes.push(match[1]);
      }

      // Match exported enums
      const enumMatches = fileContent.matchAll(/export\s+enum\s+(\w+)/g);
      for (const match of enumMatches) {
        exportedTypes.push(match[1]);
      }

      return [...new Set(exportedTypes)]; // Remove duplicates
    } catch (error: unknown) {
      console.error('Failed to extract types:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to extract types from file '${filePath}': ${errorMessage}`,
      );
    }
  }

  public async validateTypeExists(
    filePath: string,
    typeName: string,
    tsConfigPath?: string,
  ): Promise<boolean> {
    try {
      const types = await this.extractTypesFromFile(filePath, tsConfigPath);
      return types.includes(typeName);
    } catch {
      return false;
    }
  }

  /**
   * Generate TypeScript declarations for a file using the TypeScript compiler API.
   * This is particularly useful for TSX files where we need proper React component type extraction.
   */
  public async generateDeclarations(
    filePath: string,
    tsConfigPath?: string,
  ): Promise<{
    declarations: string;
    exportedTypes: string[];
  }> {
    try {
      // Find tsconfig if not provided
      if (!tsConfigPath) {
        tsConfigPath = await this.findTsConfig(path.dirname(filePath));
      }

      // Read the tsconfig
      let compilerOptions: ts.CompilerOptions = {
        declaration: true,
        emitDeclarationOnly: true,
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
        lib: ['es2020', 'dom'],
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false, // Be more permissive for better compatibility
        noEmit: false,
      };

      if (tsConfigPath) {
        const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
        if (configFile.config) {
          const parsedConfig = ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            path.dirname(tsConfigPath),
          );
          compilerOptions = { ...parsedConfig.options, ...compilerOptions };
        }
      }

      // Create a program with just this file
      const program = ts.createProgram([filePath], compilerOptions);

      // Get the source file
      const sourceFile = program.getSourceFile(filePath);
      if (!sourceFile) {
        throw new Error(`Could not read source file: ${filePath}`);
      }

      // Collect declarations
      let declarations = '';
      const exportedTypes: string[] = [];

      // Create a custom emit that captures the output
      const emitResult = program.emit(
        sourceFile,
        (fileName, data) => {
          if (fileName.endsWith('.d.ts')) {
            declarations = data;
          }
        },
        undefined,
        true,
      ); // emitOnlyDtsFiles = true

      // Check for emit errors
      const diagnostics = [
        ...program.getSyntacticDiagnostics(sourceFile),
        ...program.getSemanticDiagnostics(sourceFile),
        ...emitResult.diagnostics,
      ];

      if (diagnostics.length > 0) {
        const errors = diagnostics
          .filter((d) => d.category === ts.DiagnosticCategory.Error)
          .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));

        if (errors.length > 0) {
          console.warn('TypeScript compilation had errors:', errors);
        }
      }

      // Parse the declarations to extract exported types
      if (declarations) {
        // Extract exported types from the declaration string
        const interfaceMatches = declarations.matchAll(
          /export\s+(?:declare\s+)?interface\s+(\w+)/g,
        );
        for (const match of interfaceMatches) {
          exportedTypes.push(match[1]);
        }

        const typeMatches = declarations.matchAll(
          /export\s+(?:declare\s+)?type\s+(\w+)/g,
        );
        for (const match of typeMatches) {
          exportedTypes.push(match[1]);
        }

        const classMatches = declarations.matchAll(
          /export\s+(?:declare\s+)?(?:abstract\s+)?class\s+(\w+)/g,
        );
        for (const match of classMatches) {
          exportedTypes.push(match[1]);
        }

        const enumMatches = declarations.matchAll(
          /export\s+(?:declare\s+)?(?:const\s+)?enum\s+(\w+)/g,
        );
        for (const match of enumMatches) {
          exportedTypes.push(match[1]);
        }

        // For React components, also look for exported functions/const that might be components
        const functionMatches = declarations.matchAll(
          /export\s+(?:declare\s+)?(?:const|function)\s+(\w+):/g,
        );
        for (const match of functionMatches) {
          const componentName = match[1];
          // Check if it looks like a React component (starts with uppercase)
          if (componentName[0] === componentName[0].toUpperCase()) {
            exportedTypes.push(componentName);
          }
        }
      }

      return {
        declarations,
        exportedTypes: [...new Set(exportedTypes)],
      };
    } catch (error: unknown) {
      console.error('Failed to generate declarations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to generate declarations for '${filePath}': ${errorMessage}`,
      );
    }
  }

  /**
   * Check if a file is a TSX/JSX file that would benefit from declaration generation
   */
  private isReactFile(filePath: string): boolean {
    return filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
  }
}

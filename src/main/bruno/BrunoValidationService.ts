/**
 * Bruno Validation Service
 *
 * Core validation logic for .bru files and collections.
 * Uses adapter pattern for file system and parser abstraction.
 */

import path from 'path';
import type {
  IFileAdapter,
  IParserAdapter,
  ParseResult,
  ValidationResult,
  CollectionValidationResult,
} from './adapters/interfaces';

export class BrunoValidationService {
  constructor(
    private fileAdapter: IFileAdapter,
    private parserAdapter: IParserAdapter,
  ) {}

  /**
   * Validate a single .bru file content
   */
  async validateBruContent(content: string): Promise<ValidationResult> {
    const result = await this.parserAdapter.parseBruFile(content);
    return {
      valid: result.success,
      errors: result.errors?.filter((e) => e.severity === 'error') ?? [],
      warnings: result.errors?.filter((e) => e.severity === 'warning') ?? [],
    };
  }

  /**
   * Validate a .bru file by path
   */
  async validateBruFile(filePath: string): Promise<ValidationResult> {
    // Check if file exists
    const exists = await this.fileAdapter.exists(filePath);
    if (!exists) {
      return {
        valid: false,
        errors: [
          {
            message: `File not found: ${filePath}`,
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }

    // Check if it's a .bru file
    if (!filePath.endsWith('.bru')) {
      return {
        valid: false,
        errors: [
          {
            message: `Not a .bru file: ${filePath}`,
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }

    const content = await this.fileAdapter.readFile(filePath);
    return this.validateBruContent(content);
  }

  /**
   * Validate an entire collection directory
   */
  async validateCollection(
    collectionPath: string,
  ): Promise<CollectionValidationResult> {
    // Check if directory exists
    const exists = await this.fileAdapter.exists(collectionPath);
    if (!exists) {
      return {
        valid: false,
        collectionPath,
        totalFiles: 0,
        validFiles: 0,
        invalidFiles: 0,
        results: {},
      };
    }

    const isDir = await this.fileAdapter.isDirectory(collectionPath);
    if (!isDir) {
      return {
        valid: false,
        collectionPath,
        totalFiles: 0,
        validFiles: 0,
        invalidFiles: 0,
        results: {},
      };
    }

    const bruFiles = await this.findBruFiles(collectionPath);
    const results: Record<string, ValidationResult> = {};

    let validFiles = 0;
    let invalidFiles = 0;

    for (const file of bruFiles) {
      const result = await this.validateBruFile(file);
      results[file] = result;
      if (result.valid) {
        validFiles++;
      } else {
        invalidFiles++;
      }
    }

    return {
      valid: invalidFiles === 0,
      collectionPath,
      totalFiles: bruFiles.length,
      validFiles,
      invalidFiles,
      results,
    };
  }

  /**
   * Parse .bru content to BrunoRequest JSON
   */
  async parseBruToJson(content: string): Promise<ParseResult> {
    return this.parserAdapter.parseBruFile(content);
  }

  /**
   * Recursively find all .bru files in a directory
   */
  private async findBruFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await this.fileAdapter.readDir(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      if (await this.fileAdapter.isDirectory(fullPath)) {
        files.push(...(await this.findBruFiles(fullPath)));
      } else if (entry.endsWith('.bru')) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

/**
 * Bruno Validation Adapter Interfaces
 *
 * These interfaces enable the validation service to work with different
 * file systems (Electron fs, GitHub API, CLI) and parsers (@usebruno/lang,
 * future browser-safe alternatives).
 */

import type { BrunoRequest } from '@principal-ade/bruno-panels';

/**
 * File system adapter interface - allows swapping between
 * Electron fs, GitHub API, or CLI file access
 */
export interface IFileAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readDir(path: string): Promise<string[]>;
  isDirectory(path: string): Promise<boolean>;
}

/**
 * Parser adapter interface - abstracts .bru parsing
 * Allows swapping between @usebruno/lang (Node) and
 * future browser-safe alternatives
 */
export interface IParserAdapter {
  parseBruFile(content: string): Promise<ParseResult>;
  serializeToBru(request: BrunoRequest): Promise<string>;
}

/**
 * Result of parsing a .bru file
 */
export interface ParseResult {
  success: boolean;
  request?: BrunoRequest;
  errors?: ValidationError[];
}

/**
 * Validation error with optional location info
 */
export interface ValidationError {
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Result of validating a single .bru file
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Result of validating an entire collection
 */
export interface CollectionValidationResult {
  valid: boolean;
  collectionPath: string;
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  results: Record<string, ValidationResult>;
}

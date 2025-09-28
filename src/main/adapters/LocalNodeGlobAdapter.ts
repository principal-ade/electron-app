/**
 * Local Node.js implementation of GlobAdapter using globby
 *
 * This is a temporary copy of the NodeGlobAdapter from @a24z/core-library with fixes
 * for proper gitignore handling to exclude node_modules from markdown searches.
 *
 * TODO: Remove this when @a24z/core-library fixes the NodeGlobAdapter to handle
 * repositories without .gitignore files properly.
 */
import { globby, globbySync, type Options } from "globby";
import { GlobAdapter, GlobOptions } from "@a24z/core-library";

/**
 * Node.js implementation using globby library with enhanced gitignore support
 */
export class LocalNodeGlobAdapter implements GlobAdapter {
  async findFiles(
    patterns: string[],
    options?: GlobOptions,
  ): Promise<string[]> {
    const globbyOptions: Options = {
      ...(options?.cwd && { cwd: options.cwd }),
      ...(options?.ignore && { ignore: options.ignore }),
      ...(options?.gitignore !== undefined && { gitignore: options.gitignore }),
      ...(options?.dot !== undefined && { dot: options.dot }),
      ...(options?.onlyFiles !== undefined && { onlyFiles: options.onlyFiles }),
    };

    // Enhanced gitignore handling - add common exclusions when gitignore is enabled
    // This ensures we exclude build/dependency directories even when no .gitignore exists
    if (options?.gitignore) {
      const defaultIgnore = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**'
      ];

      // Combine with existing ignore patterns
      globbyOptions.ignore = globbyOptions.ignore
        ? [...(Array.isArray(globbyOptions.ignore) ? globbyOptions.ignore : [globbyOptions.ignore]), ...defaultIgnore]
        : defaultIgnore;
    }

    // Ensure we get strings, not Entry objects
    return globby(patterns, globbyOptions) as Promise<string[]>;
  }

  findFilesSync(patterns: string[], options?: GlobOptions): string[] {
    const globbyOptions: Options = {
      ...(options?.cwd && { cwd: options.cwd }),
      ...(options?.ignore && { ignore: options.ignore }),
      ...(options?.gitignore !== undefined && { gitignore: options.gitignore }),
      ...(options?.dot !== undefined && { dot: options.dot }),
      ...(options?.onlyFiles !== undefined && { onlyFiles: options.onlyFiles }),
    };

    // Enhanced gitignore handling - add common exclusions when gitignore is enabled
    // This ensures we exclude build/dependency directories even when no .gitignore exists
    if (options?.gitignore) {
      const defaultIgnore = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**'
      ];

      // Combine with existing ignore patterns
      globbyOptions.ignore = globbyOptions.ignore
        ? [...(Array.isArray(globbyOptions.ignore) ? globbyOptions.ignore : [globbyOptions.ignore]), ...defaultIgnore]
        : defaultIgnore;
    }

    // Ensure we get strings, not Entry objects
    return globbySync(patterns, globbyOptions) as string[];
  }

  matchesPath(patterns: string[] | undefined, candidate: string): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }

    return patterns.some((pattern) => globToRegex(pattern).test(candidate));
  }
}

function globToRegex(pattern: string): RegExp {
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "___DOUBLE_STAR___")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/___DOUBLE_STAR___\//g, "(.*\\/)?")
    .replace(/\/___DOUBLE_STAR___/g, "(\\/.*)?")
    .replace(/___DOUBLE_STAR___/g, ".*");

  regex = regex.replace(/\{([^}]+)\}/g, (_match, group) => {
    const options = group.split(",");
    return "(" + options.join("|") + ")";
  });

  return new RegExp("^" + regex + "$");
}
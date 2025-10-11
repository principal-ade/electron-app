/**
 * QualityLensService - Service for executing quality tools using codebase-quality-lenses
 * Provides tool execution through quality lenses with proper parsing and analysis
 */

import {
  ESLintLens,
  JestLens,
  TypeScriptLens,
  KnipLens,
  GitLens,
  type Lens,
  type LensResult,
  type ExecuteResult,
  type Issue,
} from '@principal-ai/codebase-quality-lenses';
import { ElectronCLIBridgeExecutor } from './ElectronCLIBridgeExecutor';
import type {
  ToolExecutionRequest,
  ToolExecutionResponse,
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

/**
 * Singleton service for executing quality tools through lenses
 */
export class QualityLensService {
  private static instance: QualityLensService;
  private executor: ElectronCLIBridgeExecutor;
  private lenses: Map<string, Lens>;

  private constructor() {
    // Initialize the executor that uses electron-cli-bridge
    this.executor = new ElectronCLIBridgeExecutor();

    // Initialize available lenses
    this.lenses = new Map();
    this.initializeLenses();
  }

  /**
   * Initialize all available lenses
   */
  private initializeLenses(): void {
    console.log('[QualityLensService] Initializing lenses...');

    // JavaScript/TypeScript lenses
    const eslintLens = new ESLintLens(this.executor);
    this.lenses.set('eslint', eslintLens);
    this.lenses.set('lint', eslintLens); // Alias

    const jestLens = new JestLens(this.executor);
    this.lenses.set('jest', jestLens);
    this.lenses.set('test', jestLens); // Alias

    const typescriptLens = new TypeScriptLens(this.executor);
    this.lenses.set('typescript', typescriptLens);
    this.lenses.set('typecheck', typescriptLens); // Alias
    this.lenses.set('tsc', typescriptLens); // Alias

    const knipLens = new KnipLens(this.executor);
    this.lenses.set('knip', knipLens);
    this.lenses.set('deadcode', knipLens); // Alias

    // Universal lenses
    const gitLens = new GitLens(this.executor);
    this.lenses.set('git', gitLens);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): QualityLensService {
    if (!QualityLensService.instance) {
      QualityLensService.instance = new QualityLensService();
    }
    return QualityLensService.instance;
  }

  /**
   * Execute a tool using the appropriate lens
   */
  public async executeTool(
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResponse> {
    const { repoPath, packagePath, toolName, command, args = [] } = request;
    const startTime = Date.now();

    // Determine working directory
    const cwd = packagePath ? `${repoPath}/${packagePath}` : repoPath;

    // Find appropriate lens for this tool
    const lens = this.findLensForTool(toolName, command);

    if (!lens) {
      // No lens available, execute directly without parsing
      console.log(
        `[QualityLensService] No lens found for tool: ${toolName}, executing directly`,
      );
      return this.executeDirectly(request, cwd, startTime);
    }

    console.log(
      `[QualityLensService] Using ${lens.name} lens for tool: ${toolName}`,
    );
    console.log(`[QualityLensService] Working directory (cwd): ${cwd}`);
    console.log(`[QualityLensService] Request details:`, {
      repoPath,
      packagePath,
      command: this.parseCommand(command),
      args: this.parseArgs(command, args),
    });

    try {
      // Configure the lens
      lens.configure({
        cwd,
        tool: {
          name: toolName,
          command: this.parseCommand(command),
          args: this.parseArgs(command, args),
          cwd,
          available: true,
        },
      });

      // Run the complete lens pipeline (execute → parse → format)
      const lensResult = await lens.run();

      // Determine actual success and exit code
      // The lens may return success:true even when the tool exits with code 1 (e.g., ESLint with errors)
      // We need to check the raw exit code and error metrics to determine actual success
      let actualExitCode = 0;
      let actualSuccess = true;

      // First, check if there's a raw exit code from the execution
      if (lensResult.raw?.exitCode !== undefined) {
        actualExitCode = lensResult.raw.exitCode;
        actualSuccess = actualExitCode === 0;
      }
      // If no raw data, fall back to checking for errors in the result
      else if (lensResult.error) {
        actualExitCode = 1;
        actualSuccess = false;
      }
      // For linting tools, check if there are error-level issues
      else if (
        lensResult.metrics?.issuesBySeverity?.error &&
        lensResult.metrics.issuesBySeverity.error > 0
      ) {
        // Tool ran successfully but found errors - this is typically exit code 1 for linters
        actualExitCode = 1;
        actualSuccess = false;
      } else {
        // Use the lens's success field as fallback
        actualSuccess = lensResult.success !== false;
        actualExitCode = actualSuccess ? 0 : 1;
      }

      // Log the lens result for debugging
      console.log(`[QualityLensService] Lens result:`, {
        lensSuccess: lensResult.success,
        actualSuccess,
        actualExitCode,
        rawExitCode: lensResult.raw?.exitCode,
        errorCount: lensResult.metrics?.issuesBySeverity?.error || 0,
        warningCount: lensResult.metrics?.issuesBySeverity?.warning || 0,
        totalIssuesInArray: lensResult.issues?.length || 0,
        issuesWithErrors:
          lensResult.issues?.filter((i) => i.severity === 'error').length || 0,
        hasError: !!lensResult.error,
        errorMessage: lensResult.error?.message,
        sampleIssues:
          lensResult.issues
            ?.slice(0, 3)
            .map((i) => ({
              file: i.file,
              severity: i.severity,
              message: i.message,
            })) || [],
      });

      return {
        success: actualSuccess,
        toolName,
        command,
        packagePath,
        exitCode: actualExitCode,
        duration: Date.now() - startTime,
        stdout: lensResult.raw?.stdout || '',
        stderr: lensResult.raw?.stderr || lensResult.error?.message || '',
        lensResult,
      };
    } catch (error: any) {
      console.error(
        `[QualityLensService] Error executing tool with lens:`,
        error,
      );

      return {
        success: false,
        toolName,
        command,
        packagePath,
        exitCode: 1,
        duration: Date.now() - startTime,
        stdout: '',
        stderr: error.message || 'Tool execution failed',
      };
    }
  }

  /**
   * Execute a tool directly without lens parsing
   */
  private async executeDirectly(
    request: ToolExecutionRequest,
    cwd: string,
    startTime: number,
  ): Promise<ToolExecutionResponse> {
    const { toolName, command, packagePath, args = [] } = request;

    try {
      const parsedCommand = this.parseCommand(command);
      const parsedArgs = this.parseArgs(command, args);

      const result = await this.executor.execute(parsedCommand, parsedArgs, {
        cwd,
      });

      // Check if this is a Prettier command and parse its output
      if (
        command.includes('prettier') ||
        toolName.toLowerCase().includes('prettier')
      ) {
        const lensResult = this.parsePrettierOutput(
          result.stdout,
          result.stderr,
          cwd,
          result.exitCode,
        );
        return {
          success: result.exitCode === 0,
          toolName,
          command,
          packagePath,
          exitCode: result.exitCode,
          duration: Date.now() - startTime,
          stdout: result.stdout,
          stderr: result.stderr,
          lensResult,
        };
      }

      return {
        success: result.exitCode === 0,
        toolName,
        command,
        packagePath,
        exitCode: result.exitCode,
        duration: Date.now() - startTime,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error: any) {
      return {
        success: false,
        toolName,
        command,
        packagePath,
        exitCode: 1,
        duration: Date.now() - startTime,
        stdout: '',
        stderr: error.message || 'Tool execution failed',
      };
    }
  }

  /**
   * Parse Prettier output into a LensResult
   */
  private parsePrettierOutput(
    stdout: string,
    stderr: string,
    cwd: string,
    exitCode: number,
  ): LensResult {
    const issues: Issue[] = [];
    const analyzedFiles: Array<{ path: string; hasIssues: boolean }> = [];

    // Parse --check output (stderr contains warnings)
    const checkOutput = stderr || stdout;
    const lines = checkOutput.split('\n');

    for (const line of lines) {
      // Match [warn] filename.ext format
      const warnMatch = line.match(/^\[warn\]\s+(.+)$/);
      if (warnMatch) {
        const filePath = warnMatch[1].trim();
        const relativePath = filePath.startsWith(cwd)
          ? filePath.substring(cwd.length + 1)
          : filePath;

        issues.push({
          file: relativePath,
          line: 1,
          column: 1,
          severity: 'warning',
          message: 'Code style issues found. Run Prettier with --write to fix.',
          rule: 'prettier',
          source: 'prettier',
          category: 'formatting',
        });

        analyzedFiles.push({
          path: relativePath,
          hasIssues: true,
        });
      }

      // Match "filename.ext 13ms (unchanged)" or "filename.ext 13ms" format from --write
      const writeMatch = line.match(/^(.+?)\s+\d+ms(?:\s+\(unchanged\))?$/);
      if (writeMatch) {
        const filePath = writeMatch[1].trim();
        const relativePath = filePath.startsWith(cwd)
          ? filePath.substring(cwd.length + 1)
          : filePath;

        const wasChanged = !line.includes('(unchanged)');

        analyzedFiles.push({
          path: relativePath,
          hasIssues: wasChanged,
        });

        // If file was changed, it had formatting issues
        if (wasChanged) {
          issues.push({
            file: relativePath,
            line: 1,
            column: 1,
            severity: 'warning',
            message: 'File was reformatted by Prettier',
            rule: 'prettier',
            source: 'prettier',
            category: 'formatting',
          });
        }
      }
    }

    return {
      lensName: 'prettier',
      tool: 'prettier',
      timestamp: Date.now(),
      success: exitCode === 0,
      issues,
      analyzedFiles,
      metrics: {
        filesAnalyzed: analyzedFiles.length,
        totalIssues: issues.length,
        issuesBySeverity: {
          error: 0,
          warning: issues.length,
          info: 0,
          hint: 0,
        },
        executionTime: 0,
        custom: {
          filesWithIssues: analyzedFiles.filter((f) => f.hasIssues).length,
          filesFormatted: issues.length,
        },
      },
    };
  }

  /**
   * Find the appropriate lens for a tool
   */
  private findLensForTool(toolName: string, command: string): Lens | undefined {
    // Direct match by tool name
    const directMatch = this.lenses.get(toolName.toLowerCase());
    if (directMatch) return directMatch;

    // Try to match by command
    const commandLower = command.toLowerCase();

    // Check for npm/yarn/pnpm scripts
    if (commandLower.includes('eslint')) return this.lenses.get('eslint');
    if (commandLower.includes('jest') || commandLower.includes('test'))
      return this.lenses.get('jest');
    if (commandLower.includes('tsc') || commandLower.includes('typecheck'))
      return this.lenses.get('typescript');
    if (commandLower.includes('knip')) return this.lenses.get('knip');
    if (commandLower.startsWith('git ')) return this.lenses.get('git');

    return undefined;
  }

  /**
   * Parse the command to extract the actual executable
   */
  private parseCommand(command: string): string {
    // Handle npm/yarn/pnpm run scripts
    if (command.startsWith('npm run ')) {
      return 'npm';
    }
    if (command.startsWith('yarn ')) {
      return 'yarn';
    }
    if (command.startsWith('pnpm ')) {
      return 'pnpm';
    }

    // Extract first word as command
    const parts = command.split(' ');
    return parts[0];
  }

  /**
   * Parse command string to extract arguments
   */
  private parseArgs(command: string, additionalArgs: string[] = []): string[] {
    const parts = command.split(' ');

    // Handle npm/yarn/pnpm run scripts
    if (command.startsWith('npm run ')) {
      return ['run', ...parts.slice(2), ...additionalArgs];
    }
    if (command.startsWith('yarn ') || command.startsWith('pnpm ')) {
      return [...parts.slice(1), ...additionalArgs];
    }

    // Return everything after the command
    return [...parts.slice(1), ...additionalArgs];
  }

  /**
   * Get available lenses
   */
  public getAvailableLenses(): string[] {
    return Array.from(this.lenses.keys());
  }

  /**
   * Check if a lens is available for a tool
   */
  public hasLensForTool(toolName: string): boolean {
    return this.lenses.has(toolName.toLowerCase());
  }
}

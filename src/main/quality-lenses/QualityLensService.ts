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
import type { PackageCommand } from '@principal-ai/codebase-composition';
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
   * Execute a tool using PackageLayer and PackageCommand
   */
  public async executeTool(
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResponse> {
    const startTime = Date.now();

    // Validate required fields
    if (!request.packageLayer || !request.packageCommand) {
      throw new Error(
        'packageLayer and packageCommand are required. Legacy execution has been removed.',
      );
    }

    return this.executeWithPackageLayer(request, startTime);
  }

  /**
   * Execute using PackageLayer and PackageCommand (new preferred way)
   */
  private async executeWithPackageLayer(
    request: ToolExecutionRequest,
    startTime: number,
  ): Promise<ToolExecutionResponse> {
    const { repoPath, packageLayer, packageCommand } = request;

    if (!packageLayer || !packageCommand) {
      throw new Error(
        'packageLayer and packageCommand are required for new execution path',
      );
    }

    // Determine working directory
    const packagePath = packageLayer.packageData.path || '';
    const cwd = packagePath ? `${repoPath}/${packagePath}` : repoPath;

    // Check if this is a lens command
    if (!packageCommand.isLensCommand || !packageCommand.lensId) {
      console.log(
        `[QualityLensService] Not a lens command, executing directly: ${packageCommand.name}`,
      );
      return this.executeNonLensCommand(request, packageCommand, cwd, startTime);
    }

    // Find lens by ID (no parsing needed!)
    const lens = this.lenses.get(packageCommand.lensId);

    if (!lens) {
      console.warn(
        `[QualityLensService] No lens registered for: ${packageCommand.lensId}`,
      );
      return this.executeNonLensCommand(request, packageCommand, cwd, startTime);
    }

    console.log(
      `[QualityLensService] Using ${lens.name} for command: ${packageCommand.name} (lensId: ${packageCommand.lensId})`,
    );

    try {
      // Parse command string (composition package already validated it)
      const { command, args } = this.parseCommandString(
        packageCommand.command,
      );

      // Configure the lens
      lens.configure({
        cwd,
        tool: {
          name: packageCommand.lensId,
          command,
          args,
          cwd,
          available: true,
        },
      });

      // Run the lens pipeline
      const lensResult = await lens.run();

      // Determine success and exit code
      const { success, exitCode } = this.determineLensSuccess(lensResult);

      return {
        success,
        toolName: packageCommand.lensId,
        command: packageCommand.command,
        packagePath,
        exitCode,
        duration: Date.now() - startTime,
        stdout: lensResult.raw?.stdout || '',
        stderr: lensResult.raw?.stderr || lensResult.error?.message || '',
        lensResult,

        // NEW: Include quality metrics context
        qualityContext: {
          lensId: packageCommand.lensId,
          operation: packageCommand.lensOperation,
          availableLenses: packageLayer.qualityMetrics?.availableLenses,
          missingLenses: packageLayer.qualityMetrics?.missingLenses,
        },
      };
    } catch (error: any) {
      console.error(`[QualityLensService] Error:`, error);
      return this.createErrorResponse(
        packageCommand.lensId || packageCommand.name,
        packageCommand.command,
        packagePath,
        error,
        startTime,
      );
    }
  }

  /**
   * Execute a non-lens command directly
   */
  private async executeNonLensCommand(
    request: ToolExecutionRequest,
    packageCommand: PackageCommand,
    cwd: string,
    startTime: number,
  ): Promise<ToolExecutionResponse> {
    const { command, args } = this.parseCommandString(packageCommand.command);

    try {
      const result = await this.executor.execute(command, args, { cwd });

      return {
        success: result.exitCode === 0,
        toolName: packageCommand.name,
        command: packageCommand.command,
        packagePath: request.packageLayer?.packageData.path,
        exitCode: result.exitCode,
        duration: Date.now() - startTime,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error: any) {
      return this.createErrorResponse(
        packageCommand.name,
        packageCommand.command,
        request.packageLayer?.packageData.path,
        error,
        startTime,
      );
    }
  }





  /**
   * Parse command string into command + args (used by new execution path)
   * Simplified since composition package already validated it
   */
  private parseCommandString(commandString: string): {
    command: string;
    args: string[];
  } {
    // Handle npm/yarn/pnpm run scripts
    if (commandString.startsWith('npm run ')) {
      const parts = commandString.split(' ');
      return { command: 'npm', args: ['run', ...parts.slice(2)] };
    }
    if (commandString.startsWith('yarn ')) {
      const parts = commandString.split(' ');
      return { command: 'yarn', args: parts.slice(1) };
    }
    if (commandString.startsWith('pnpm ')) {
      const parts = commandString.split(' ');
      return { command: 'pnpm', args: parts.slice(1) };
    }

    // Direct command
    const parts = commandString.split(' ');
    return { command: parts[0], args: parts.slice(1) };
  }

  /**
   * Determine success and exit code from lens result
   */
  private determineLensSuccess(lensResult: LensResult): {
    success: boolean;
    exitCode: number;
  } {
    let exitCode = 0;
    let success = true;

    // First, check if there's a raw exit code from the execution
    if (lensResult.raw?.exitCode !== undefined) {
      exitCode = lensResult.raw.exitCode;
      success = exitCode === 0;
    }
    // If no raw data, fall back to checking for errors in the result
    else if (lensResult.error) {
      exitCode = 1;
      success = false;
    }
    // For linting tools, check if there are error-level issues
    else if (
      lensResult.metrics?.issuesBySeverity?.error &&
      lensResult.metrics.issuesBySeverity.error > 0
    ) {
      // Tool ran successfully but found errors - this is typically exit code 1 for linters
      exitCode = 1;
      success = false;
    } else {
      // Use the lens's success field as fallback
      success = lensResult.success !== false;
      exitCode = success ? 0 : 1;
    }

    return { success, exitCode };
  }

  /**
   * Create error response consistently
   */
  private createErrorResponse(
    toolName: string,
    command: string,
    packagePath: string | undefined,
    error: Error,
    startTime: number,
  ): ToolExecutionResponse {
    return {
      success: false,
      toolName,
      command,
      packagePath,
      exitCode: 1,
      duration: Date.now() - startTime,
      stdout: '',
      stderr: error.message || 'Tool execution failed',
      error: error.message,
    };
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

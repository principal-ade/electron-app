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
} from '@principal-ai/codebase-quality-lenses';
import { ElectronCLIBridgeExecutor } from './ElectronCLIBridgeExecutor';

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  repoPath: string;
  packagePath?: string;
  toolName: string;
  command: string;
  args?: string[];
}

/**
 * Tool execution response with lens analysis
 */
export interface ToolExecutionResponse {
  success: boolean;
  toolName: string;
  command: string;
  packagePath?: string;
  exitCode: number;
  duration: number;
  stdout: string;
  stderr: string;
  lensResult?: LensResult; // Parsed and analyzed result from lens
}

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
  public async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    const { repoPath, packagePath, toolName, command, args = [] } = request;
    const startTime = Date.now();

    // Determine working directory
    const cwd = packagePath ? `${repoPath}/${packagePath}` : repoPath;

    // Find appropriate lens for this tool
    const lens = this.findLensForTool(toolName, command);

    if (!lens) {
      // No lens available, execute directly without parsing
      console.log(`[QualityLensService] No lens found for tool: ${toolName}, executing directly`);
      return this.executeDirectly(request, cwd, startTime);
    }

    console.log(`[QualityLensService] Using ${lens.name} lens for tool: ${toolName}`);
    console.log(`[QualityLensService] Working directory (cwd): ${cwd}`);
    console.log(`[QualityLensService] Request details:`, {
      repoPath,
      packagePath,
      command: this.parseCommand(command),
      args: this.parseArgs(command, args)
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

      // Extract execution details from the lens result
      const success = lensResult.success !== false; // success is true unless explicitly false
      const exitCode = lensResult.success ? 0 : 1; // Approximate exit code based on success

      return {
        success,
        toolName,
        command,
        packagePath,
        exitCode,
        duration: Date.now() - startTime,
        stdout: '', // Lens results don't expose raw stdout
        stderr: lensResult.error?.message || '',
        lensResult,
      };
    } catch (error: any) {
      console.error(`[QualityLensService] Error executing tool with lens:`, error);

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
    startTime: number
  ): Promise<ToolExecutionResponse> {
    const { toolName, command, packagePath, args = [] } = request;

    try {
      const parsedCommand = this.parseCommand(command);
      const parsedArgs = this.parseArgs(command, args);

      const result = await this.executor.execute(parsedCommand, parsedArgs, { cwd });

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
    if (commandLower.includes('jest') || commandLower.includes('test')) return this.lenses.get('jest');
    if (commandLower.includes('tsc') || commandLower.includes('typecheck')) return this.lenses.get('typescript');
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
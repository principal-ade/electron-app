import { spawn, type ChildProcessByStdio } from 'child_process';
import type { Readable } from 'stream';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

import { UnifiedSecureStorage } from '../UnifiedSecureStorage';
import type {
  ActRunnerWorkflowCompleteEvent,
  ActRunnerWorkflowErrorEvent,
  ActRunnerWorkflowEvent,
  ActRunnerWorkflowProgressEvent,
  ActRunnerWorkflowStepEvent,
  RunRepositoryActionRequest,
  RunRepositoryActionResult,
  ValidateRunRequirementsRequest,
  ValidateRunRequirementsResult,
} from '../../../shared/types/act.types';
import { ActRunnerWorkflowChannels } from '../../../shared/types/act.types';

interface SecretsFileInfo {
  directory: string;
  filePath: string;
}

interface ExecutionContext {
  executionId: string;
  process: ChildProcessByStdio<null, Readable, Readable>;
  repoId: string;
  repoPath: string;
  workflowPath: string;
  actionId: string;
  startedAt: number;
  secretsFile?: SecretsFileInfo | null;
}

type WorkflowEventName = keyof typeof ActRunnerWorkflowChannels;

type WritableWorkflowEvent = Extract<
  ActRunnerWorkflowEvent,
  { type: 'start' | 'progress' | 'step' | 'error' | 'complete' }
>;

// ANSI escape sequence regex - control characters are intentional
const ANSI_ESCAPE_REGEX =
  // eslint-disable-next-line no-control-regex
  /\u001b\[[0-9;]*[a-zA-Z]|\u001b\][0-9;]*;.*?(?:\u0007|\u001b\\)/g;

export class ActRunnerService extends EventEmitter {
  private readonly storage: UnifiedSecureStorage;
  private readonly runningExecutions = new Map<string, ExecutionContext>();
  private readonly preferredBinary?: string;
  private resolvedBinary: string | null = null;

  constructor(options: { actBinaryPath?: string } = {}) {
    super();
    this.storage = UnifiedSecureStorage.getInstance();
    this.preferredBinary =
      options.actBinaryPath ?? process.env.ACT_BINARY_PATH ?? undefined;
  }

  async validateRunRequirements(
    request: ValidateRunRequirementsRequest,
  ): Promise<ValidateRunRequirementsResult> {
    const messages: string[] = [];

    let secretsConfigured = false;
    try {
      const secrets = await this.storage.getSecrets(request.repoId);
      secretsConfigured = !!secrets && Object.keys(secrets).length > 0;
      if (!secretsConfigured) {
        messages.push('No secrets configured for the selected repository.');
      }
    } catch (error) {
      secretsConfigured = false;
      messages.push('Failed to access secure storage for repository secrets.');
      console.error('[ActRunnerService] Failed to read secrets:', error);
    }

    let repoAccessible = true;
    try {
      await fsPromises.access(request.repoPath, fs.constants.F_OK);
    } catch (error) {
      repoAccessible = false;
      messages.push('Repository path is not accessible on disk.');
      console.error(
        '[ActRunnerService] Repository path not accessible:',
        error,
      );
    }

    const actInstalled = await this.validateInstallation();
    if (!actInstalled) {
      messages.push('The nektos/act binary was not found on this system.');
    }

    if (!repoAccessible) {
      messages.push(
        'Resolve repository path issues before attempting to run workflows.',
      );
    }

    return {
      secretsConfigured,
      actInstalled,
      messages: messages.length > 0 ? messages : undefined,
    };
  }

  async runWorkflow(
    request: RunRepositoryActionRequest,
  ): Promise<RunRepositoryActionResult> {
    const binaryAvailable = await this.validateInstallation();
    if (!binaryAvailable) {
      return {
        success: false,
        error:
          'The nektos/act binary is not installed. Install act and try again.',
      };
    }

    const repoStat = await this.ensureRepositoryPath(request.repoPath);
    if (!repoStat) {
      return {
        success: false,
        error:
          'Repository path is not accessible. Verify the repository exists locally.',
      };
    }

    const executionId = this.generateExecutionId();
    let secretsFile: SecretsFileInfo | null = null;

    try {
      secretsFile = await this.createSecretsFile(request.repoId, executionId);
      const args = this.buildActArgs(request, secretsFile?.filePath ?? null);
      const cwd = request.repoPath;
      const binary = this.resolvedBinary ?? this.preferredBinary ?? 'act';

      const child = spawn(binary, args, {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      const context: ExecutionContext = {
        executionId,
        process: child,
        repoId: request.repoId,
        repoPath: request.repoPath,
        workflowPath: request.workflowPath,
        actionId: request.actionId,
        startedAt: Date.now(),
        secretsFile,
      };

      this.runningExecutions.set(executionId, context);

      this.emitWorkflowEvent(ActRunnerWorkflowChannels.START, {
        type: 'start',
        ...this.buildEventBase(context),
      });

      this.streamProcessOutput(context, child);
      this.watchProcessLifecycle(context, child);

      return { success: true, executionId };
    } catch (error) {
      await this.deleteSecretsFile(secretsFile);
      console.error('[ActRunnerService] Failed to start workflow run:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start act workflow execution.',
      };
    }
  }

  async stopWorkflow(executionId: string): Promise<void> {
    const context = this.runningExecutions.get(executionId);
    if (!context) {
      return;
    }

    const { process } = context;
    if (process.killed) {
      return;
    }

    this.emitWorkflowEvent(ActRunnerWorkflowChannels.PROGRESS, {
      type: 'progress',
      stream: 'stdout',
      message: 'Termination requested by user.',
      raw: 'Termination requested by user.',
      ...this.buildEventBase(context),
    });

    process.kill('SIGTERM');

    const timeout = setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGKILL');
      }
    }, 5000);

    process.once('exit', () => clearTimeout(timeout));
  }

  async validateInstallation(): Promise<boolean> {
    if (this.resolvedBinary) {
      return true;
    }

    // Try candidates in priority order:
    // 1. User-specified path (explicit user preference takes priority)
    // 2. Bundled binary (guaranteed to work in packaged app)
    // 3. System-installed 'act' in PATH (fallback for dev/advanced users)

    const candidates: string[] = [];

    // Add user-specified path first if provided
    if (this.preferredBinary && this.preferredBinary.trim().length > 0) {
      candidates.push(this.preferredBinary);
    }

    // Add bundled binary as primary option for packaged apps
    const { EnvironmentConfig } = await import('../../utils/environmentConfig');
    const bundledPath = await EnvironmentConfig.getBundledActPath();
    if (bundledPath) {
      candidates.push(bundledPath);
    }

    // Fall back to system PATH
    candidates.push('act');

    for (const candidate of candidates) {
      const resolved = await this.probeBinary(candidate);
      if (resolved) {
        this.resolvedBinary = resolved;
        console.log(`[ActRunnerService] Using act binary: ${resolved}`);
        return true;
      }
    }

    console.warn('[ActRunnerService] No act binary found in any location');
    return false;
  }

  private async ensureRepositoryPath(
    repoPath: string,
  ): Promise<fs.Stats | null> {
    try {
      return await fsPromises.stat(repoPath);
    } catch (error) {
      console.error(
        '[ActRunnerService] Unable to stat repository path:',
        error,
      );
      return null;
    }
  }

  private generateExecutionId(): string {
    return `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  }

  private buildEventBase(context: ExecutionContext) {
    return {
      executionId: context.executionId,
      repoId: context.repoId,
      repoPath: context.repoPath,
      workflowPath: context.workflowPath,
      actionId: context.actionId,
      timestamp: Date.now(),
    };
  }

  private emitWorkflowEvent(
    channel: (typeof ActRunnerWorkflowChannels)[WorkflowEventName],
    payload: WritableWorkflowEvent,
  ) {
    this.emit(channel, payload);
  }

  private streamProcessOutput(
    context: ExecutionContext,
    process: ChildProcessByStdio<null, Readable, Readable>,
  ) {
    if (process.stdout) {
      const stdoutReader = readline.createInterface({
        input: process.stdout,
        crlfDelay: Infinity,
      });

      stdoutReader.on('line', (line) => {
        this.handleProcessOutput(context, line, 'stdout');
      });

      process.once('close', () => stdoutReader.close());
    }

    if (process.stderr) {
      const stderrReader = readline.createInterface({
        input: process.stderr,
        crlfDelay: Infinity,
      });

      stderrReader.on('line', (line) => {
        this.handleProcessOutput(context, line, 'stderr');
      });

      process.once('close', () => stderrReader.close());
    }
  }

  private handleProcessOutput(
    context: ExecutionContext,
    rawLine: string,
    stream: 'stdout' | 'stderr',
  ) {
    if (!rawLine) {
      return;
    }

    const sanitized = rawLine.replace(ANSI_ESCAPE_REGEX, '').replace(/\r/g, '');
    const message = sanitized.trim();

    if (message.length === 0) {
      return;
    }

    const base = this.buildEventBase(context);

    const progressEvent: ActRunnerWorkflowProgressEvent = {
      type: 'progress',
      stream,
      message,
      raw: sanitized,
      ...base,
    };

    this.emitWorkflowEvent(ActRunnerWorkflowChannels.PROGRESS, progressEvent);

    const stepInfo = this.detectStepInformation(message);
    if (stepInfo) {
      const stepEvent: ActRunnerWorkflowStepEvent = {
        type: 'step',
        status: stepInfo.status,
        label: stepInfo.label,
        raw: sanitized,
        ...base,
      };
      this.emitWorkflowEvent(ActRunnerWorkflowChannels.STEP, stepEvent);
    }

    if (stream === 'stderr' || message.toLowerCase().includes('error')) {
      const errorEvent: ActRunnerWorkflowErrorEvent = {
        type: 'error',
        message,
        raw: sanitized,
        ...base,
      };
      this.emitWorkflowEvent(ActRunnerWorkflowChannels.ERROR, errorEvent);
    }
  }

  private detectStepInformation(
    message: string,
  ): { status: 'success' | 'failure' | 'running'; label: string } | null {
    const trimmed = message.trim();

    const successMatch = trimmed.match(/^(?:✔|✓|✅)\s*(.+)$/);
    if (successMatch) {
      return { status: 'success', label: successMatch[1].trim() };
    }

    const failureMatch = trimmed.match(/^(?:✖|✕|×|❌|⚠)\s*(.+)$/);
    if (failureMatch) {
      return { status: 'failure', label: failureMatch[1].trim() };
    }

    const runningMatch = trimmed.match(/^(?:▶|►|▸|•|●|○)\s*(.+)$/);
    if (runningMatch) {
      return { status: 'running', label: runningMatch[1].trim() };
    }

    const groupMatch = trimmed.match(/^::(group|endgroup)::(.+)$/i);
    if (groupMatch) {
      return {
        status: groupMatch[1].toLowerCase() === 'group' ? 'running' : 'success',
        label: groupMatch[2].trim(),
      };
    }

    return null;
  }

  private watchProcessLifecycle(
    context: ExecutionContext,
    process: ChildProcessByStdio<null, Readable, Readable>,
  ) {
    process.once('error', async (error) => {
      console.error('[ActRunnerService] Process error:', error);
      const errorEvent: ActRunnerWorkflowErrorEvent = {
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Unknown process error',
        raw: error instanceof Error ? error.message : String(error),
        ...this.buildEventBase(context),
      };
      this.emitWorkflowEvent(ActRunnerWorkflowChannels.ERROR, errorEvent);
      await this.cleanupExecution(context.executionId);
    });

    process.once('exit', async (code) => {
      const success = code === 0;
      const completeEvent: ActRunnerWorkflowCompleteEvent = {
        type: 'complete',
        success,
        exitCode: code ?? null,
        durationMs: Date.now() - context.startedAt,
        ...this.buildEventBase(context),
      };
      this.emitWorkflowEvent(ActRunnerWorkflowChannels.COMPLETE, completeEvent);
      await this.cleanupExecution(context.executionId);
    });
  }

  private buildActArgs(
    request: RunRepositoryActionRequest,
    secretsFile: string | null,
  ): string[] {
    const args: string[] = ['-j', request.actionId];

    if (request.workflowPath) {
      args.push('--workflows', request.workflowPath);
    }

    if (secretsFile) {
      args.push('--secret-file', secretsFile);
    }

    // Use medium image by default (compatible with most actions)
    args.push('--pull=false'); // Don't auto-pull, use cached images
    args.push('-P', 'ubuntu-latest=catthehacker/ubuntu:act-latest');

    return args;
  }

  private async probeBinary(command: string): Promise<string | null> {
    return await new Promise((resolve) => {
      const child = spawn(command, ['--version'], {
        stdio: 'ignore',
        shell: process.platform === 'win32',
      });

      child.once('error', () => resolve(null));
      child.once('exit', (code) => {
        resolve(code === 0 ? command : null);
      });
    });
  }

  private async createSecretsFile(
    repoId: string,
    executionId: string,
  ): Promise<SecretsFileInfo | null> {
    const secrets = await this.storage.getSecrets(repoId);
    if (!secrets || Object.keys(secrets).length === 0) {
      return null;
    }

    const tempDir = await fsPromises.mkdtemp(
      path.join(os.tmpdir(), 'act-secrets-'),
    );
    const filePath = path.join(tempDir, `secrets-${executionId}.env`);

    const lines: string[] = [
      `# Generated: ${new Date().toISOString()}`,
      `# Repository: ${repoId}`,
      '# Auto-cleanup: true',
      '',
    ];

    for (const [key, value] of Object.entries(secrets)) {
      if (value === undefined || value === null) {
        continue;
      }
      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);
      const escaped = serialized.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      lines.push(`${key}="${escaped}"`);
    }

    const buffer = Buffer.from(lines.join('\n'), 'utf8');
    await fsPromises.writeFile(filePath, buffer, { mode: 0o600 });
    await fsPromises.chmod(filePath, 0o600).catch(() => {});

    buffer.fill(0);

    return { directory: tempDir, filePath };
  }

  private async cleanupSecretsFile(executionId: string): Promise<void> {
    const context = this.runningExecutions.get(executionId);
    await this.deleteSecretsFile(context?.secretsFile ?? null);
  }

  private async deleteSecretsFile(info: SecretsFileInfo | null | undefined) {
    if (!info) {
      return;
    }

    try {
      await fsPromises.unlink(info.filePath).catch(() => {});
      await fsPromises
        .rm(info.directory, { recursive: true, force: true })
        .catch(() => {});
    } catch (error) {
      console.warn('[ActRunnerService] Failed to cleanup secrets file:', error);
    }
  }

  private async cleanupExecution(executionId: string): Promise<void> {
    await this.cleanupSecretsFile(executionId);
    this.runningExecutions.delete(executionId);
  }
}

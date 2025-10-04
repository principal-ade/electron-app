/**
 * Universal worker for executing CLI commands
 * Runs in utilityProcess context with full Node.js capabilities
 */

const { execSync, spawn } = require('child_process');

class CommandExecutor {
  constructor() {
    this.activeProcesses = new Map();
  }

  /**
   * Main entry point for command execution
   */
  execute({ id, command, args, options }) {
    const startTime = Date.now();
    
    try {
      // For now, use execSync as it's most reliable in Electron
      // Later we can add streaming support with spawn
      const result = this.executeSync(id, command, args, options, startTime);
      this.sendResponse(result);
    } catch (error) {
      this.sendResponse({
        id,
        type: 'error',
        error: error.message,
        exitCode: error.status || -1,
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * Execute command synchronously using execSync
   */
  executeSync(id, command, args, options, startTime) {
    // Build the full command string
    const fullCommand = this.buildCommand(command, args);


    // Prepare execSync options
    // For SSH to work, we need to preserve SSH_AUTH_SOCK and other SSH-related env vars
    // Clean up NODE_OPTIONS to avoid ts-node conflicts from the parent process
    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.TS_NODE_PROJECT;
    delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

    const execEnv = options.env ? { ...cleanEnv, ...options.env } : cleanEnv;


    const execOptions = {
      encoding: options.encoding || 'utf8',
      cwd: options.cwd || process.cwd(),
      env: execEnv,
      timeout: options.timeout || 60000,
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024, // 10MB default
      stdio: 'pipe'
    };

    // Add shell option if specified
    if (options.shell !== undefined) {
      execOptions.shell = options.shell;
    }

    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      // Execute the command
      stdout = execSync(fullCommand, execOptions);

      // execSync returns stdout directly
      return {
        id,
        type: 'complete',
        data: stdout,
        stderr: '',  // No stderr on success
        exitCode: 0,
        duration: Date.now() - startTime
      };
    } catch (error) {
      // execSync throws on non-zero exit codes
      // The error object contains stdout, stderr, and status
      stdout = error.stdout ? error.stdout.toString() : '';
      stderr = error.stderr ? error.stderr.toString() : '';
      exitCode = error.status || 1;


      // For git commands, return both stdout and stderr properly
      if (command === 'git') {
        return {
          id,
          type: 'complete',
          data: stdout || '',  // stdout in data field
          stderr: stderr || '',  // stderr in separate field
          exitCode: exitCode,
          duration: Date.now() - startTime
        };
      }

      // For some commands (like ESLint), non-zero exit doesn't mean failure
      // It just means there were linting issues found
      if (command === 'npx' && args[0] === 'eslint') {

        // ESLint returns exit code 1 when it finds problems
        // This is not an error, just a result
        // ESLint outputs JSON to stdout even when there are errors
        // But if stdout is empty, it might mean ESLint didn't run properly
        const output = stdout || stderr || '';

        return {
          id,
          type: 'complete',
          data: output,
          exitCode: exitCode,
          duration: Date.now() - startTime
        };
      }

      // For other commands, treat non-zero exit as error
      throw error;
    }
  }

  /**
   * Execute command with streaming output using spawn
   * (For future implementation when needed)
   */
  executeStream(id, command, args, options, startTime) {
    const spawnOptions = {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      shell: true // Use shell to avoid fd issues
    };

    const child = spawn(command, args, spawnOptions);
    this.activeProcesses.set(id, child);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      this.sendResponse({
        id,
        type: 'stdout',
        data: chunk
      });
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      this.sendResponse({
        id,
        type: 'stderr',
        data: chunk
      });
    });

    child.on('error', (error) => {
      this.activeProcesses.delete(id);
      this.sendResponse({
        id,
        type: 'error',
        error: error.message,
        exitCode: -1,
        duration: Date.now() - startTime
      });
    });

    child.on('exit', (code) => {
      this.activeProcesses.delete(id);
      this.sendResponse({
        id,
        type: 'complete',
        data: stdout,
        exitCode: code || 0,
        duration: Date.now() - startTime
      });
    });
  }

  /**
   * Build command string from command and args
   */
  buildCommand(command, args) {
    if (!args || args.length === 0) {
      return command;
    }

    // Quote arguments that contain spaces
    const quotedArgs = args.map(arg => {
      if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
        return `"${arg}"`;
      }
      return arg;
    });

    return `${command} ${quotedArgs.join(' ')}`;
  }

  /**
   * Kill an active process
   */
  kill(id) {
    const process = this.activeProcesses.get(id);
    if (process) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(id);
      this.sendResponse({
        id,
        type: 'complete',
        exitCode: -1,
        error: 'Process killed'
      });
    }
  }

  /**
   * Send response back to main process
   */
  sendResponse(response) {
    if (process.parentPort) {
      process.parentPort.postMessage(response);
    } else if (process.send) {
      // Fallback for child_process.fork
      process.send(response);
    } else {
      console.error('[Worker] No communication channel available, response:', response);
    }
  }
}

// Initialize executor
const executor = new CommandExecutor();

// Log startup
console.log('[Worker] Starting universal worker...');
console.log('[Worker] parentPort available:', !!process.parentPort);

// In utilityProcess, we need to use process.parentPort for communication
if (process.parentPort) {
  console.log('[Worker] Setting up parentPort message handler');
  
  // Send ready signal immediately
  try {
    process.parentPort.postMessage({ type: 'ready' });
    console.log('[Worker] Sent ready signal');
  } catch (error) {
    console.error('[Worker] Failed to send ready signal:', error);
  }
  
  // utilityProcess uses parentPort.on('message', callback) directly
  process.parentPort.on('message', (e) => {
    // In utilityProcess, the message comes wrapped in an event with a data property
    const data = e.data || e; // Handle both formats

    switch (data.type) {
      case 'execute':
        executor.execute(data);
        break;
      case 'stream':
        // For now, treat stream same as execute
        // We can implement true streaming later if needed
        executor.execute(data);
        break;
      case 'kill':
        executor.kill(data.id);
        break;
      default:
        console.error('[Worker] Unknown command type:', data.type);
    }
  });
  
  console.log('[Worker] Universal worker ready and listening');
} else {
  console.error('[Worker] FATAL: No parentPort available - not running in utilityProcess');
  process.exit(1);
}
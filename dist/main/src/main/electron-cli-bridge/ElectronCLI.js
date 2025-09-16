/**
 * ElectronCLI - High-level API for electron-cli-bridge
 * Provides convenient methods for common CLI operations
 */
import { CLIBridge } from './CLIBridge';
import { GitExecutor } from './executors/GitExecutor';
export class ElectronCLI {
    bridge;
    initPromise = null;
    _git = null;
    constructor(options) {
        this.bridge = new CLIBridge(options);
    }
    /**
     * Initialize the CLI bridge
     */
    async initialize() {
        if (!this.initPromise) {
            this.initPromise = this.bridge.initialize();
        }
        return this.initPromise;
    }
    /**
     * Ensure bridge is initialized before executing commands
     */
    async ensureInitialized() {
        if (!this.initPromise) {
            await this.initialize();
        }
    }
    /**
     * Get GitExecutor instance (lazy initialization)
     */
    get git() {
        if (!this._git) {
            this._git = new GitExecutor(this.bridge);
        }
        return this._git;
    }
    /**
     * Execute a generic command
     */
    async execute(command, args = [], options = {}) {
        await this.ensureInitialized();
        return this.bridge.execute(command, args, options);
    }
    /**
     * Execute a command from a string (parses command and args)
     */
    async exec(commandString, options) {
        // Simple parsing - splits on spaces but respects quotes
        const parts = commandString.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const command = parts[0] || '';
        const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, ''));
        return this.execute(command, args, options);
    }
    /**
     * Execute npm commands
     */
    async npm(args, options) {
        return this.execute('npm', args, options);
    }
    /**
     * Execute yarn commands
     */
    async yarn(args, options) {
        return this.execute('yarn', args, options);
    }
    /**
     * Execute pnpm commands
     */
    async pnpm(args, options) {
        return this.execute('pnpm', args, options);
    }
    /**
     * Run ESLint on files
     */
    async eslint(patterns, options = {}) {
        const eslintArgs = ['eslint'];
        // Add format flag for JSON output
        eslintArgs.push('--format', options.format || 'json');
        // Add fix flag if requested
        if (options.fix) {
            eslintArgs.push('--fix');
        }
        // Add file patterns
        eslintArgs.push(...patterns);
        // Execute ESLint
        const result = await this.execute('npx', eslintArgs, {
            ...options,
            // Increase timeout for ESLint as it can take a while
            timeout: options.timeout || 120000,
        });
        console.log('[ESLint] Execute result:', {
            exitCode: result.exitCode,
            hasStdout: !!result.stdout,
            stdoutLength: result.stdout?.length || 0,
            hasStderr: !!result.stderr,
            stderrPreview: result.stderr?.substring(0, 200)
        });
        // Parse JSON output
        try {
            // ESLint may exit with code 1 if there are linting errors
            // But the output is still valid JSON
            if (result.stdout) {
                const results = JSON.parse(result.stdout);
                console.log(`[ESLint] Successfully parsed ${results.length} file results`);
                const totalMessages = results.reduce((sum, r) => sum + r.messages.length, 0);
                console.log(`[ESLint] Total messages across all files: ${totalMessages}`);
                return results;
            }
            console.log('[ESLint] No stdout, returning empty results');
            return [];
        }
        catch (error) {
            // If parsing fails, return empty results
            console.error('[ESLint] Failed to parse output:', error);
            console.error('[ESLint] Raw stdout:', result.stdout?.substring(0, 500));
            return [];
        }
    }
    /**
     * Run Prettier on files
     */
    async prettier(patterns, options = {}) {
        const prettierArgs = ['prettier'];
        // Add write flag if requested
        if (options.write) {
            prettierArgs.push('--write');
        }
        // Add check flag if requested
        if (options.check) {
            prettierArgs.push('--check');
        }
        // Add file patterns
        prettierArgs.push(...patterns);
        return this.execute('npx', prettierArgs, options);
    }
    /**
     * Run Jest tests
     */
    async jest(args = [], options = {}) {
        const jestArgs = ['jest'];
        // Add coverage flag if requested
        if (options.coverage) {
            jestArgs.push('--coverage');
        }
        // Add watch flag if requested
        if (options.watch) {
            jestArgs.push('--watch');
        }
        // Add any additional args
        jestArgs.push(...args);
        return this.execute('npx', jestArgs, options);
    }
    /**
     * Run TypeScript compiler
     */
    async tsc(args = [], options) {
        return this.execute('npx', ['tsc', ...args], options);
    }
    /**
     * Check if a command is available
     */
    async which(command) {
        try {
            const result = await this.execute('which', [command]);
            if (result.success && result.stdout) {
                return result.stdout.trim();
            }
        }
        catch (error) {
            // Command not found
        }
        return null;
    }
    /**
     * Get version of a command
     */
    async version(command) {
        try {
            const result = await this.execute(command, ['--version']);
            if (result.success && result.stdout) {
                return result.stdout.trim();
            }
        }
        catch (error) {
            // Command failed
        }
        return null;
    }
    /**
     * Shutdown the CLI bridge
     */
    async shutdown() {
        await this.bridge.shutdown();
        this.initPromise = null;
    }
}
// Export a singleton instance for convenience
export const electronCLI = new ElectronCLI();

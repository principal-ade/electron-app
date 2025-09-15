/**
 * Main process service for collecting TypeScript and ESLint violations
 *
 * This runs in the main process where we have access to Node.js APIs
 * and the TypeScript/ESLint packages.
 */
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { electronCLI } from '../electron-cli-bridge';
export class ViolationCollectionService {
    tsConfigCache = new Map();
    cliInitialized = false;
    /**
     * Initialize the electron-cli-bridge
     */
    async ensureCLIInitialized() {
        if (!this.cliInitialized) {
            await electronCLI.initialize();
            this.cliInitialized = true;
        }
    }
    /**
     * Collect violations for packages in a repository
     */
    async collectViolations(rootPath, packages, options = {}) {
        const startTime = Date.now();
        const packageResults = [];
        const opts = {
            includeTypescript: true,
            includeEslint: true,
            maxFiles: 500,
            ...options
        };
        // Process each package
        for (const pkg of packages) {
            // pkg.path is already absolute, or if relative, resolve it
            const packagePath = path.isAbsolute(pkg.path)
                ? pkg.path
                : path.join(rootPath, pkg.path);
            const fileViolations = new Map();
            try {
                // Get files to process for this package
                const files = this.getFilesToProcess(packagePath, opts.maxFiles);
                // Collect violations based on what the package has
                const promises = [];
                if (opts.includeTypescript && pkg.hasTypescript) {
                    promises.push(this.collectTypeScriptViolations(packagePath, files, fileViolations));
                }
                if (opts.includeEslint && pkg.hasEslint) {
                    console.log(`[ViolationCollection] Running ESLint for package ${pkg.name} at ${packagePath}`);
                    promises.push(this.collectESLintViolations(packagePath, files, fileViolations));
                }
                else if (opts.includeEslint) {
                    console.log(`[ViolationCollection] Skipping ESLint for package ${pkg.name} - hasEslint: ${pkg.hasEslint}`);
                }
                await Promise.all(promises);
                // Calculate package totals
                let totalViolations = 0;
                let totalErrors = 0;
                let totalWarnings = 0;
                let totalInfo = 0;
                for (const file of fileViolations.values()) {
                    totalViolations += file.violations.length;
                    totalErrors += file.errorCount;
                    totalWarnings += file.warningCount;
                    totalInfo += file.infoCount;
                }
                if (fileViolations.size > 0) {
                    packageResults.push({
                        packageName: pkg.name,
                        packagePath: pkg.path,
                        absolutePath: pkg.absolutePath, // Preserve absolute path
                        fileViolations,
                        totalFiles: fileViolations.size,
                        totalViolations,
                        totalErrors,
                        totalWarnings,
                        totalInfo
                    });
                }
            }
            catch (error) {
                console.error(`[ViolationCollection] Error processing package ${pkg.name}:`, error);
            }
        }
        // Calculate overall totals
        let totalFiles = 0;
        let totalViolations = 0;
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalInfo = 0;
        for (const pkg of packageResults) {
            totalFiles += pkg.totalFiles;
            totalViolations += pkg.totalViolations;
            totalErrors += pkg.totalErrors;
            totalWarnings += pkg.totalWarnings;
            totalInfo += pkg.totalInfo;
        }
        return {
            timestamp: Date.now(),
            rootPath,
            packages: packageResults,
            totalPackages: packageResults.length,
            totalFiles,
            totalViolations,
            totalErrors,
            totalWarnings,
            totalInfo,
            collectionTime: Date.now() - startTime
        };
    }
    /**
     * Get files to process
     */
    getFilesToProcess(rootPath, maxFiles) {
        const files = [];
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
        const walkDir = (dir) => {
            if (files.length >= maxFiles)
                return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (files.length >= maxFiles)
                        return;
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(rootPath, fullPath);
                    // Skip common directories
                    if (entry.isDirectory()) {
                        if (!['node_modules', 'dist', 'build', '.next', 'coverage', '.git'].includes(entry.name)) {
                            walkDir(fullPath);
                        }
                    }
                    else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (extensions.includes(ext)) {
                            files.push(relativePath);
                        }
                    }
                }
            }
            catch (error) {
                console.warn(`[ViolationCollection] Error reading directory ${dir}:`, error);
            }
        };
        walkDir(rootPath);
        return files;
    }
    /**
     * Collect TypeScript violations
     */
    async collectTypeScriptViolations(rootPath, files, fileViolations) {
        try {
            // Find tsconfig
            const configPath = ts.findConfigFile(rootPath, ts.sys.fileExists);
            if (!configPath) {
                console.log('[TypeScript] No tsconfig.json found');
                return;
            }
            // Parse config
            const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
            if (configFile.error) {
                console.error('[TypeScript] Error reading config:', configFile.error);
                return;
            }
            const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
            // Create program
            const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
            const diagnostics = ts.getPreEmitDiagnostics(program);
            // Process diagnostics
            for (const diagnostic of diagnostics) {
                if (!diagnostic.file || diagnostic.start === undefined)
                    continue;
                const relativePath = path.relative(rootPath, diagnostic.file.fileName);
                if (!files.includes(relativePath))
                    continue;
                const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                let severity = 'error';
                if (diagnostic.category === ts.DiagnosticCategory.Warning) {
                    severity = 'warning';
                }
                else if (diagnostic.category === ts.DiagnosticCategory.Suggestion ||
                    diagnostic.category === ts.DiagnosticCategory.Message) {
                    severity = 'info';
                }
                const violation = {
                    type: 'typescript',
                    severity,
                    message,
                    rule: `TS${diagnostic.code}`,
                    line: line + 1,
                    column: character + 1
                };
                // Add to file violations
                if (!fileViolations.has(relativePath)) {
                    fileViolations.set(relativePath, {
                        filePath: diagnostic.file.fileName,
                        relativePath,
                        violations: [],
                        errorCount: 0,
                        warningCount: 0,
                        infoCount: 0
                    });
                }
                const fileData = fileViolations.get(relativePath);
                fileData.violations.push(violation);
                if (severity === 'error')
                    fileData.errorCount++;
                else if (severity === 'warning')
                    fileData.warningCount++;
                else
                    fileData.infoCount++;
            }
            console.log(`[TypeScript] Found ${diagnostics.length} diagnostics`);
        }
        catch (error) {
            console.error('[TypeScript] Error collecting violations:', error);
        }
    }
    /**
     * Collect ESLint violations using electron-cli-bridge
     */
    async collectESLintViolations(rootPath, files, fileViolations) {
        try {
            console.log('[ESLint] Running ESLint via electron-cli-bridge');
            // Ensure CLI is initialized
            await this.ensureCLIInitialized();
            // Convert relative paths to absolute paths for ESLint
            const absolutePaths = files.map(f => path.join(rootPath, f));
            // Run ESLint using electron-cli-bridge
            const eslintResults = await electronCLI.eslint(absolutePaths, {
                cwd: rootPath,
                format: 'json',
                timeout: 120000 // 2 minute timeout for large projects
            });
            // Process the results
            for (const result of eslintResults) {
                if (result.messages.length === 0)
                    continue;
                const relativePath = path.relative(rootPath, result.filePath);
                // Initialize file data if needed
                if (!fileViolations.has(relativePath)) {
                    fileViolations.set(relativePath, {
                        filePath: result.filePath,
                        relativePath,
                        violations: [],
                        errorCount: 0,
                        warningCount: 0,
                        infoCount: 0
                    });
                }
                const fileData = fileViolations.get(relativePath);
                for (const message of result.messages) {
                    const severity = message.severity === 2 ? 'error' :
                        message.severity === 1 ? 'warning' : 'info';
                    const violation = {
                        type: 'eslint',
                        severity,
                        message: message.message,
                        rule: message.ruleId || undefined,
                        line: message.line,
                        column: message.column,
                        endLine: message.endLine,
                        endColumn: message.endColumn
                    };
                    fileData.violations.push(violation);
                    if (severity === 'error')
                        fileData.errorCount++;
                    else if (severity === 'warning')
                        fileData.warningCount++;
                    else
                        fileData.infoCount++;
                }
            }
            console.log('[ESLint] Successfully collected violations via electron-cli-bridge');
        }
        catch (error) {
            console.error('[ESLint] Error collecting violations:', error);
        }
    }
    /**
     * Clear caches
     */
    clearCache(rootPath) {
        if (rootPath) {
            this.tsConfigCache.delete(rootPath);
        }
        else {
            this.tsConfigCache.clear();
        }
    }
}
// Export singleton
export const violationCollectionService = new ViolationCollectionService();

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
const execAsync = promisify(exec);
export class KnipAnalysisService {
    static async runAnalysis(directoryPath) {
        try {
            // First check if the directory exists
            if (!fs.existsSync(directoryPath)) {
                return {
                    error: `Directory does not exist: ${directoryPath}`,
                    hasIssues: false,
                };
            }
            // Check if it's a Node.js project
            const packageJsonPath = path.join(directoryPath, 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                // Try to provide a basic file analysis for non-Node.js projects
                return this.basicFileAnalysis(directoryPath);
            }
            // Check if knip is installed globally
            const isKnipAvailable = await this.checkKnipAvailability();
            if (!isKnipAvailable) {
                return {
                    error: 'Knip is not installed globally.\n\nTo use advanced tech debt analysis, please install knip:\n\nnpm install -g knip\n\nOr with yarn:\nyarn global add knip\n\nOr with pnpm:\npnpm add -g knip',
                    hasIssues: false,
                };
            }
            // Run knip analysis
            return this.runKnipAnalysis(directoryPath);
        }
        catch (error) {
            return {
                error: `Failed to analyze project: ${error.message}`,
                hasIssues: false,
            };
        }
    }
    static async checkKnipAvailability() {
        try {
            await execAsync('which knip');
            return true;
        }
        catch {
            // On Windows, try 'where' command
            try {
                await execAsync('where knip');
                return true;
            }
            catch {
                return false;
            }
        }
    }
    static async runKnipAnalysis(directoryPath) {
        console.log('[KnipAnalysis] Running analysis on directory:', directoryPath);
        try {
            // Create a minimal knip config if one doesn't exist
            const knipConfigPath = path.join(directoryPath, 'knip.json');
            const hasKnipConfig = fs.existsSync(knipConfigPath) ||
                fs.existsSync(path.join(directoryPath, '.knip.json')) ||
                fs.existsSync(path.join(directoryPath, 'knip.config.js')) ||
                fs.existsSync(path.join(directoryPath, 'knip.config.ts'));
            let tempConfigCreated = false;
            if (!hasKnipConfig) {
                // Create a minimal config
                const minimalConfig = {
                    entry: ['src/index.*', 'index.*', 'main.*', 'app.*'],
                    project: ['src/**/*.*', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
                };
                fs.writeFileSync(knipConfigPath, JSON.stringify(minimalConfig, null, 2));
                tempConfigCreated = true;
            }
            try {
                // Run knip with JSON reporter
                const { stdout, stderr } = await execAsync('knip --reporter json', {
                    cwd: directoryPath,
                    maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large outputs
                    env: { ...process.env, NODE_ENV: 'production' },
                });
                if (stderr && !stdout) {
                    return {
                        error: `Knip analysis failed: ${stderr}`,
                        hasIssues: false,
                    };
                }
                // Parse the JSON output
                console.log('[KnipAnalysis] Raw stdout:', stdout);
                const result = this.parseKnipOutput(stdout);
                console.log('[KnipAnalysis] Parsed result:', result);
                return result;
            }
            finally {
                // Clean up temporary config
                if (tempConfigCreated && fs.existsSync(knipConfigPath)) {
                    fs.unlinkSync(knipConfigPath);
                }
            }
        }
        catch (error) {
            console.log('[KnipAnalysis] Error running knip:', error);
            console.log('[KnipAnalysis] Error code:', error.code);
            console.log('[KnipAnalysis] Error stdout:', error.stdout);
            console.log('[KnipAnalysis] Error stderr:', error.stderr);
            // Check if this is a non-zero exit code (knip found issues)
            if (error.code === 1 && error.stdout) {
                console.log('[KnipAnalysis] Exit code 1 with stdout:', error.stdout);
                const result = this.parseKnipOutput(error.stdout);
                console.log('[KnipAnalysis] Parsed result from error:', result);
                return result;
            }
            // Provide more detailed error information
            let errorMessage = `Failed to run knip analysis: ${error.message}`;
            // Common error scenarios
            if (error.message.includes('No entry files found')) {
                errorMessage =
                    'Knip could not find any entry files in this project.\n\nThis might be because:\n- The project structure is non-standard\n- Entry files are in unexpected locations\n\nTry creating a knip.json config file in the project root.';
            }
            else if (error.message.includes('Cannot find module')) {
                errorMessage =
                    'Knip encountered missing dependencies.\n\nTry running "npm install" or "pnpm install" in the project first.';
            }
            else if (error.stderr) {
                errorMessage += `\n\nError details: ${error.stderr}`;
            }
            return {
                error: errorMessage,
                hasIssues: false,
            };
        }
    }
    static parseKnipOutput(output) {
        try {
            // Try to parse as JSON first
            const jsonData = JSON.parse(output);
            const result = {
                unusedFiles: [],
                unusedExports: [],
                unusedDependencies: [],
                unresolvedImports: [],
                hasIssues: false,
                raw: output,
            };
            // Parse the JSON structure based on knip's output format
            if (Array.isArray(jsonData.files)) {
                result.unusedFiles = jsonData.files;
            }
            if (jsonData.issues) {
                // Parse issues array
                jsonData.issues.forEach((issue) => {
                    if (issue.dependencies) {
                        issue.dependencies.forEach((dep) => {
                            if (dep.name && !result.unusedDependencies.includes(dep.name)) {
                                result.unusedDependencies.push(dep.name);
                            }
                        });
                    }
                    if (issue.exports) {
                        issue.exports.forEach((exp) => {
                            result.unusedExports.push({
                                file: issue.file,
                                export: exp.name,
                            });
                        });
                    }
                    if (issue.unresolved) {
                        issue.unresolved.forEach((imp) => {
                            result.unresolvedImports.push({
                                file: issue.file,
                                import: imp.name || imp,
                            });
                        });
                    }
                });
            }
            result.hasIssues =
                (result.unusedFiles?.length ?? 0) > 0 ||
                    (result.unusedExports?.length ?? 0) > 0 ||
                    (result.unusedDependencies?.length ?? 0) > 0 ||
                    (result.unresolvedImports?.length ?? 0) > 0;
            return result;
        }
        catch (parseError) {
            // If JSON parsing fails, return empty results
            return {
                unusedFiles: [],
                unusedExports: [],
                unusedDependencies: [],
                unresolvedImports: [],
                hasIssues: false,
                error: 'Failed to parse knip output. The project may have no issues.',
            };
        }
    }
    static async basicFileAnalysis(directoryPath) {
        try {
            // For non-Node.js projects, provide basic information
            const allFiles = [];
            const emptyFiles = [];
            const walkDir = (dir) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);
                    if (stat.isDirectory() &&
                        !file.startsWith('.') &&
                        file !== 'node_modules') {
                        walkDir(filePath);
                    }
                    else if (stat.isFile()) {
                        const relativePath = path.relative(directoryPath, filePath);
                        allFiles.push(relativePath);
                        // Check if file is empty
                        if (stat.size === 0) {
                            emptyFiles.push(relativePath);
                        }
                    }
                }
            };
            walkDir(directoryPath);
            return {
                unusedFiles: emptyFiles,
                unusedExports: [],
                unusedDependencies: [],
                unresolvedImports: [],
                hasIssues: emptyFiles.length > 0,
                error: allFiles.length === 0 ? 'No files found in directory' : undefined,
            };
        }
        catch (error) {
            return {
                error: `Failed to analyze directory: ${error.message}`,
                hasIssues: false,
            };
        }
    }
}

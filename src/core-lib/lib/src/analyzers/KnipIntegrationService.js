import { spawn } from 'child_process';
export class KnipIntegrationService {
    constructor() {
        this.fileTree = null;
        this.knipAvailable = false;
        this.checkKnipAvailability();
    }
    /**
     * Check if Knip is installed in the project or globally
     */
    async checkKnipAvailability() {
        try {
            await this.executeCommand('npx', ['knip', '--version']);
            this.knipAvailable = true;
            return true;
        }
        catch {
            this.knipAvailable = false;
            return false;
        }
    }
    /**
     * Perform basic unused code analysis without Knip
     * This provides immediate value without requiring installation
     */
    async performBasicAnalysis(fileTree) {
        this.fileTree = fileTree;
        const suggestions = [];
        // 1. Find potentially unused files (not imported anywhere)
        const unusedFiles = await this.findUnreferencedFiles(fileTree);
        unusedFiles.forEach(file => {
            suggestions.push({
                type: 'remove-file',
                description: `File "${file}" appears to be unused`,
                file,
                autoFixAvailable: false,
                impact: 'medium',
            });
        });
        // 2. Find common unused dependencies patterns
        const unusedDeps = await this.findObviousUnusedDependencies(fileTree);
        unusedDeps.forEach(dep => {
            suggestions.push({
                type: 'remove-dependency',
                description: `Dependency "${dep}" appears to be unused`,
                file: 'package.json',
                autoFixAvailable: true,
                impact: 'low',
                command: `npm uninstall ${dep}`,
            });
        });
        // 3. Find duplicate dependencies
        const duplicates = await this.findDuplicateDependencies(fileTree);
        duplicates.forEach(dup => {
            suggestions.push({
                type: 'remove-dependency',
                description: `Duplicate dependency "${dup.name}" in ${dup.locations.join(', ')}`,
                file: dup.locations[0],
                autoFixAvailable: false,
                impact: 'low',
            });
        });
        return suggestions;
    }
    /**
     * Run full Knip analysis if available
     */
    async performFullAnalysis(projectPath) {
        if (!this.knipAvailable) {
            console.log('Knip is not installed. Run: npm install --save-dev knip');
            return null;
        }
        try {
            const output = await this.executeCommand('npx', ['knip', '--reporter', 'json'], {
                cwd: projectPath,
            });
            return JSON.parse(output);
        }
        catch (error) {
            console.error('Failed to run Knip analysis:', error);
            return null;
        }
    }
    /**
     * Generate Knip configuration based on project structure
     */
    async generateKnipConfig(_fileTree) {
        const config = {
            $schema: 'https://unpkg.com/knip@5/schema.json',
            entry: [],
            project: ['src/**/*.{ts,tsx,js,jsx}'],
            ignore: [],
            ignoreDependencies: [],
        };
        // Detect entry points
        const entryPoints = this.detectEntryPoints(_fileTree);
        config.entry = entryPoints;
        // Detect test files to ignore
        const testPatterns = this.detectTestPatterns(_fileTree);
        config.ignore = testPatterns;
        // Detect build tools to ignore
        const buildTools = this.detectBuildTools(_fileTree);
        config.ignoreDependencies = buildTools;
        return config;
    }
    /**
     * Provide installation guide for Knip
     */
    getInstallationGuide() {
        return `
# Installing Knip for Advanced Code Analysis

## Quick Install
\`\`\`bash
npm install --save-dev knip
\`\`\`

## Create Configuration
\`\`\`bash
npx knip --init
\`\`\`

## Run Analysis
\`\`\`bash
npx knip
\`\`\`

## Auto-fix Issues
\`\`\`bash
npx knip --fix
\`\`\`

Benefits:
- Find all unused exports, dependencies, and files
- Automatic fixes for most issues
- Integration with 100+ build tools and frameworks
- Detailed reports and traces
    `;
    }
    /**
     * Convert Knip results to cleanup suggestions
     */
    convertToSuggestions(knipResult) {
        const suggestions = [];
        // Convert unused dependencies
        knipResult.dependencies.unused.forEach(dep => {
            suggestions.push({
                type: 'remove-dependency',
                description: `Remove unused dependency "${dep}"`,
                file: 'package.json',
                autoFixAvailable: true,
                impact: 'low',
                command: `npm uninstall ${dep}`,
            });
        });
        // Convert unlisted dependencies
        knipResult.dependencies.unlisted.forEach(dep => {
            suggestions.push({
                type: 'add-dependency',
                description: `Add missing dependency "${dep}"`,
                file: 'package.json',
                autoFixAvailable: true,
                impact: 'high',
                command: `npm install ${dep}`,
            });
        });
        // Convert unused exports
        knipResult.exports.unused.forEach(({ file, symbols }) => {
            symbols.forEach(symbol => {
                suggestions.push({
                    type: 'remove-export',
                    description: `Remove unused export "${symbol}" from ${file}`,
                    file,
                    autoFixAvailable: true,
                    impact: 'low',
                });
            });
        });
        return suggestions;
    }
    // Helper methods
    async findUnreferencedFiles(fileTree) {
        const allFiles = fileTree.allFiles.filter(f => f.extension === '.ts' ||
            f.extension === '.tsx' ||
            f.extension === '.js' ||
            f.extension === '.jsx');
        // This is a simplified check - in reality, you'd parse imports
        const unreferenced = [];
        // Check for files that are not index files and not in common entry points
        for (const file of allFiles) {
            if (!file.name.includes('index') &&
                !file.relativePath.includes('main') &&
                !file.relativePath.includes('App')) {
                // Simplified check - would need actual import parsing
                unreferenced.push(file.relativePath);
            }
        }
        return unreferenced.slice(0, 5); // Limit to top 5 for demo
    }
    async findObviousUnusedDependencies(_fileTree) {
        // Find package.json files
        const packageJsonFiles = _fileTree.allFiles.filter(f => f.name === 'package.json');
        if (packageJsonFiles.length === 0)
            return [];
        // This would need actual implementation to read package.json and check imports
        // For now, return empty array as placeholder
        return [];
    }
    async findDuplicateDependencies(_fileTree) {
        // This would check for duplicates across multiple package.json files in monorepo
        return [];
    }
    detectEntryPoints(_fileTree) {
        const entryPoints = [];
        // Common entry point patterns
        const patterns = [
            'src/index.ts',
            'src/index.tsx',
            'src/index.js',
            'src/main.ts',
            'src/main.tsx',
            'src/main.js',
            'src/app.ts',
            'src/app.tsx',
            'src/app.js',
            'index.ts',
            'index.js',
            'main.ts',
            'main.js',
        ];
        for (const pattern of patterns) {
            const file = _fileTree.allFiles.find(f => f.relativePath === pattern);
            if (file) {
                entryPoints.push(pattern);
            }
        }
        return entryPoints;
    }
    detectTestPatterns(_fileTree) {
        const patterns = [];
        // Check for test directories
        if (_fileTree.allDirectories.some(d => d.name === '__tests__')) {
            patterns.push('**/__tests__/**');
        }
        if (_fileTree.allDirectories.some(d => d.name === 'tests')) {
            patterns.push('**/tests/**');
        }
        // Check for test file patterns
        if (_fileTree.allFiles.some(f => f.name.includes('.test.'))) {
            patterns.push('**/*.test.*');
        }
        if (_fileTree.allFiles.some(f => f.name.includes('.spec.'))) {
            patterns.push('**/*.spec.*');
        }
        return patterns;
    }
    detectBuildTools(_fileTree) {
        // Common build tools that might not be directly imported
        const buildTools = [
            'webpack',
            'vite',
            'rollup',
            'esbuild',
            'parcel',
            'eslint',
            'prettier',
            'typescript',
            'ts-node',
            '@types/node',
            'jest',
            'vitest',
            'playwright',
        ];
        // Would need to actually check package.json
        return buildTools;
    }
    async executeCommand(command, args, options) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, options);
            let output = '';
            let error = '';
            child.stdout?.on('data', data => {
                output += data.toString();
            });
            child.stderr?.on('data', data => {
                error += data.toString();
            });
            child.on('close', code => {
                if (code === 0) {
                    resolve(output);
                }
                else {
                    reject(new Error(error || `Command failed with code ${code}`));
                }
            });
        });
    }
}
// Export singleton instance
export const knipIntegration = new KnipIntegrationService();
//# sourceMappingURL=KnipIntegrationService.js.map
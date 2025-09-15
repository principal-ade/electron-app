import { builtInTemplates } from './templates';
import { aiScriptAnalysisService } from './AIScriptAnalysisService';
export class ToolDetectionService {
    /**
     * Scan a package directory and detect available tools
     */
    async detectTools(packagePath) {
        try {
            // Read package.json
            const packageJsonPath = packagePath
                ? `${packagePath}/package.json`
                : 'package.json';
            const result = await window.electron.fileSystem.readFile(packageJsonPath);
            if (!result || !result.content) {
                return {
                    packagePath,
                    packageName: 'unknown',
                    detectedTools: [],
                    suggestedTemplates: [],
                };
            }
            const packageJson = JSON.parse(result.content);
            const detectedTools = [];
            // Combine all dependencies
            const allDependencies = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies,
                ...packageJson.peerDependencies,
            };
            // Detect package manager
            const packageManager = await this.detectPackageManager(packagePath);
            // Check each template's package matchers
            for (const template of builtInTemplates) {
                const matchedPackages = this.findMatchingPackages(allDependencies, template.tool.packageMatchers);
                if (matchedPackages.length > 0) {
                    // Check for config files
                    const configFiles = await this.findConfigFiles(packagePath, template.tool.configFiles || []);
                    // Get the primary package version
                    const primaryPackage = matchedPackages.find((pkg) => pkg === template.tool.name) ||
                        matchedPackages[0];
                    const version = allDependencies[primaryPackage] || 'unknown';
                    // Check if required ignore file exists
                    let hasIgnoreFile;
                    if (template.tool.requiresIgnoreFile) {
                        hasIgnoreFile = configFiles.includes(template.tool.requiresIgnoreFile);
                        console.log('[ToolDetection] Checking for ignore file:', {
                            tool: template.tool.name,
                            requiresIgnoreFile: template.tool.requiresIgnoreFile,
                            configFiles,
                            hasIgnoreFile,
                        });
                    }
                    detectedTools.push({
                        name: template.tool.name,
                        version: version.replace(/[\^~]/, ''),
                        packages: matchedPackages,
                        configFiles,
                        availableScripts: packageJson.scripts || {},
                        packageManager,
                        packagePath,
                        hasIgnoreFile,
                    });
                }
            }
            // Get suggested templates
            const suggestedTemplates = this.matchTemplates(detectedTools);
            return {
                packagePath,
                packageName: packageJson.name || 'unknown',
                detectedTools,
                suggestedTemplates,
            };
        }
        catch (error) {
            console.error('Error detecting tools:', error);
            return {
                packagePath,
                packageName: 'unknown',
                detectedTools: [],
                suggestedTemplates: [],
            };
        }
    }
    /**
     * Match templates to detected tools
     */
    matchTemplates(detectedTools) {
        const matchedTemplates = [];
        const toolNames = new Set(detectedTools.map((tool) => tool.name));
        for (const template of builtInTemplates) {
            if (toolNames.has(template.tool.name)) {
                matchedTemplates.push(template);
            }
        }
        return matchedTemplates;
    }
    /**
     * Generate executable validations for a package
     */
    generateValidations(packagePath, templates, detectedTools, currentDirectory) {
        const validations = [];
        for (const template of templates) {
            const tool = detectedTools.find((t) => t.name === template.tool.name);
            if (!tool)
                continue;
            // Determine available actions based on scripts and config
            const availableActions = [];
            for (const actionGroup of template.actions) {
                for (const action of actionGroup.items) {
                    // Check if required script exists
                    if (action.requiresScript &&
                        !tool.availableScripts[action.requiresScript]) {
                        continue;
                    }
                    // Check if required config exists
                    if (action.requiresConfig) {
                        const hasAllConfigs = action.requiresConfig.every((config) => tool.configFiles.some((file) => file.includes(config)));
                        if (!hasAllConfigs)
                            continue;
                    }
                    availableActions.push(action.id);
                }
            }
            validations.push({
                id: `${packagePath}-${template.id}`,
                packagePath,
                templateId: template.id,
                detectedTool: tool,
                availableActions,
            });
        }
        return validations;
    }
    /**
     * Detect package manager for a package
     */
    async detectPackageManager(packagePath) {
        try {
            // Check for lock files
            const lockFiles = [
                { file: 'pnpm-lock.yaml', manager: 'pnpm' },
                { file: 'yarn.lock', manager: 'yarn' },
                { file: 'package-lock.json', manager: 'npm' },
            ];
            for (const { file, manager } of lockFiles) {
                const filePath = packagePath ? `${packagePath}/${file}` : file;
                try {
                    const stats = await window.electron.fileSystem.getFileStats(filePath);
                    if (stats && !stats.isDirectory)
                        return manager;
                }
                catch {
                    // Continue checking
                }
            }
            // Check parent directories for monorepo
            if (packagePath) {
                const parentPath = packagePath.split('/').slice(0, -1).join('/');
                if (parentPath) {
                    return this.detectPackageManager(parentPath);
                }
            }
            return 'npm'; // Default
        }
        catch {
            return 'npm';
        }
    }
    /**
     * Find matching packages based on patterns
     */
    findMatchingPackages(dependencies, patterns) {
        const matches = [];
        const dependencyNames = Object.keys(dependencies);
        for (const pattern of patterns) {
            if (pattern.includes('*')) {
                // Convert glob to regex
                const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
                matches.push(...dependencyNames.filter((name) => regex.test(name)));
            }
            else {
                // Exact match
                if (dependencyNames.includes(pattern)) {
                    matches.push(pattern);
                }
            }
        }
        return [...new Set(matches)]; // Remove duplicates
    }
    /**
     * Find config files in a directory
     */
    async findConfigFiles(packagePath, configPatterns) {
        const foundConfigs = [];
        for (const pattern of configPatterns) {
            try {
                if (pattern.includes('*')) {
                    // Handle glob patterns
                    const files = await window.electron.fileSystem.readDirectory(packagePath || '.');
                    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
                    const matches = files.filter((file) => regex.test(file.name));
                    foundConfigs.push(...matches.map((f) => f.name));
                }
                else {
                    // Check exact file
                    const filePath = packagePath ? `${packagePath}/${pattern}` : pattern;
                    try {
                        const stats = await window.electron.fileSystem.getFileStats(filePath);
                        if (stats && !stats.isDirectory) {
                            foundConfigs.push(pattern);
                        }
                    }
                    catch {
                        // File doesn't exist
                    }
                }
            }
            catch {
                // Continue checking other patterns
            }
        }
        return foundConfigs;
    }
    /**
     * Detect active layers for a package (simplified version)
     */
    async detectActiveLayers(packagePath) {
        const activeLayers = [];
        try {
            // Read package.json to detect technology layers
            const packageJsonPath = packagePath
                ? `${packagePath}/package.json`
                : 'package.json';
            const result = await window.electron.fileSystem.readFile(packageJsonPath);
            if (result?.content) {
                const packageJson = JSON.parse(result.content);
                const allDeps = {
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies,
                };
                // Detect TypeScript
                if (allDeps.typescript || allDeps['@types/node']) {
                    activeLayers.push('typescript');
                }
                // Detect JavaScript (always present if package.json exists)
                activeLayers.push('javascript');
                // Detect React
                if (allDeps.react || allDeps['react-dom']) {
                    activeLayers.push('react');
                }
                // Detect Vue
                if (allDeps.vue || allDeps['@vue/cli']) {
                    activeLayers.push('vue');
                }
                // Detect Angular
                if (allDeps['@angular/core']) {
                    activeLayers.push('angular');
                }
            }
        }
        catch (error) {
            console.warn('Failed to detect active layers:', error);
            // Default to JavaScript
            activeLayers.push('javascript');
        }
        return activeLayers;
    }
    /**
     * Generate context-aware command
     */
    async generateCommand(command, packageManager, packagePath, currentDirectory, action, selectedLayers) {
        let generatedCommand = command;
        // Apply layer overrides if available - use the complete override command
        if (action?.layerOverrides && selectedLayers && selectedLayers.length > 0) {
            // Use selected layers to build the command
            const layersToCheck = selectedLayers;
            // Collect extensions from all selected layers
            const allExtensions = new Set();
            let hasOverrides = false;
            for (const layer of layersToCheck) {
                if (action.layerOverrides[layer]) {
                    hasOverrides = true;
                    // Extract extensions from the override command
                    const override = action.layerOverrides[layer];
                    const extMatch = override.match(/--ext\s+([^\s]+)/);
                    if (extMatch) {
                        const extensions = extMatch[1].split(',');
                        extensions.forEach((ext) => allExtensions.add(ext.trim()));
                    }
                }
            }
            // If we have layer overrides, build a custom command
            if (hasOverrides && allExtensions.size > 0) {
                const extensionList = Array.from(allExtensions).join(',');
                // Build the command based on the base command structure
                if (command.includes('eslint')) {
                    // For ESLint, build the direct command
                    if (command.includes('--fix')) {
                        generatedCommand = `npx eslint . --fix --ext ${extensionList}`;
                    }
                    else if (command.includes('--print-config')) {
                        generatedCommand = command; // Keep debug commands as-is
                    }
                    else {
                        generatedCommand = `npx eslint . --ext ${extensionList}`;
                    }
                }
                else {
                    // For other tools, try to intelligently add extensions
                    if (generatedCommand.includes('--ext')) {
                        generatedCommand = generatedCommand.replace(/--ext\s+[^\s]+/g, `--ext ${extensionList}`);
                    }
                    else {
                        generatedCommand = `${generatedCommand} --ext ${extensionList}`;
                    }
                }
            }
        }
        // Replace package manager placeholder if still present
        if (generatedCommand.includes('${pm}')) {
            const pmCommand = packageManager === 'yarn' ? 'yarn' : `${packageManager} run`;
            generatedCommand = generatedCommand.replace('${pm}', pmCommand);
        }
        // Handle script placeholder if needed
        generatedCommand = generatedCommand.replace('${script}', '');
        // Add directory navigation if needed
        if (currentDirectory !== packagePath && packagePath) {
            // Calculate relative path
            const relativePath = this.getRelativePath(currentDirectory, packagePath);
            if (relativePath && relativePath !== '.') {
                generatedCommand = `cd ${relativePath} && ${generatedCommand}`;
            }
        }
        return generatedCommand;
    }
    /**
     * Read and parse ignore file patterns
     */
    async readIgnorePatterns(packagePath, ignoreFileName) {
        try {
            const ignoreFilePath = packagePath
                ? `${packagePath}/${ignoreFileName}`
                : ignoreFileName;
            const result = await window.electron.fileSystem.readFile(ignoreFilePath);
            if (!result || !result.content) {
                return [];
            }
            // Parse ignore file - each line is a pattern
            const patterns = result.content
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line && !line.startsWith('#')); // Remove empty lines and comments
            console.log('[ToolDetection] Parsed ignore patterns:', patterns);
            return patterns;
        }
        catch (error) {
            console.log('[ToolDetection] No ignore file found or error reading:', error);
            return [];
        }
    }
    /**
     * Check if a file path matches ignore patterns
     */
    isPathIgnored(filePath, ignorePatterns) {
        const normalizedPath = filePath.replace(/\\/g, '/');
        for (const pattern of ignorePatterns) {
            // Simple pattern matching - this is a basic implementation
            // In production, you'd want to use a proper gitignore parser
            // Handle directory patterns (ending with /)
            if (pattern.endsWith('/')) {
                const dir = pattern.slice(0, -1);
                if (normalizedPath.startsWith(`${dir}/`) || normalizedPath === dir) {
                    return true;
                }
            }
            // Handle file/directory patterns
            if (normalizedPath.includes(pattern)) {
                return true;
            }
            // Handle glob patterns (simplified)
            if (pattern.includes('*')) {
                const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
                if (regex.test(normalizedPath)) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Count files by extension patterns in a directory
     */
    async countFilesByExtensions(packagePath, extensions, ignorePatterns) {
        try {
            // Convert extensions to glob patterns
            const patterns = extensions.map((ext) => {
                // Remove leading dot if present
                const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
                return `**/*.${cleanExt}`;
            });
            let totalCount = 0;
            for (const pattern of patterns) {
                try {
                    const files = await window.electron.fileSystem.glob(pattern, {
                        cwd: packagePath,
                    });
                    // Filter out ignored files if ignore patterns are provided
                    if (ignorePatterns && ignorePatterns.length > 0) {
                        const filteredFiles = files.filter((file) => !this.isPathIgnored(file, ignorePatterns));
                        totalCount += filteredFiles.length;
                    }
                    else {
                        totalCount += files.length;
                    }
                }
                catch (error) {
                    console.warn(`Failed to count files for pattern ${pattern}:`, error);
                }
            }
            return totalCount;
        }
        catch (error) {
            console.warn('Failed to count files by extensions:', error);
            return 0;
        }
    }
    /**
     * Get layer file information for a package
     */
    async getLayerFileInfo(packagePath, layers, ignorePatterns) {
        const layerFileInfo = {};
        // Define layer to extension mapping
        const layerExtensions = {
            javascript: ['.js'],
            typescript: ['.ts'],
            react: ['.jsx', '.tsx'],
            vue: ['.vue'],
            python: ['.py'],
            java: ['.java'],
            css: ['.css'],
            scss: ['.scss', '.sass'],
            html: ['.html', '.htm'],
        };
        for (const layer of layers) {
            const extensions = layerExtensions[layer] || [];
            const count = await this.countFilesByExtensions(packagePath, extensions, ignorePatterns);
            layerFileInfo[layer] = {
                extensions,
                count,
            };
        }
        return layerFileInfo;
    }
    /**
     * Get relative path from current to target directory
     */
    getRelativePath(from, to) {
        const fromParts = from.split('/').filter((p) => p);
        const toParts = to.split('/').filter((p) => p);
        // Find common base
        let commonLength = 0;
        for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
            if (fromParts[i] === toParts[i]) {
                commonLength++;
            }
            else {
                break;
            }
        }
        // Build relative path
        const upCount = fromParts.length - commonLength;
        const downPath = toParts.slice(commonLength);
        const ups = new Array(upCount).fill('..');
        return [...ups, ...downPath].join('/') || '.';
    }
    /**
     * Detect tools with AI assistance for better script categorization
     */
    async detectToolsWithAI(packagePath, useLocalModel = false) {
        try {
            // First do regular tool detection
            const baseResult = await this.detectTools(packagePath);
            // Check if AI is available
            let aiAvailability;
            try {
                aiAvailability = await aiScriptAnalysisService.checkAIAvailability();
            }
            catch (error) {
                console.log('[ToolDetectionService] Error checking AI availability:', error);
                return baseResult;
            }
            const provider = useLocalModel ? 'ollama' : 'openrouter';
            if (!aiAvailability || !aiAvailability[provider]) {
                console.log(`[ToolDetectionService] AI provider ${provider} not available, using base detection`);
                return baseResult;
            }
            // Read package.json for AI analysis
            const packageJsonPath = packagePath
                ? `${packagePath}/package.json`
                : 'package.json';
            const result = await window.electron.fileSystem.readFile(packageJsonPath);
            if (!result || !result.content) {
                return baseResult;
            }
            const packageJson = JSON.parse(result.content);
            // If there are scripts, analyze them with AI
            if (packageJson.scripts && Object.keys(packageJson.scripts).length > 0) {
                console.log(`[ToolDetectionService] Analyzing ${Object.keys(packageJson.scripts).length} scripts with AI`);
                const aiAnalysis = await aiScriptAnalysisService.analyzeScripts(packageJson, packagePath, useLocalModel);
                // Generate AI-based validation template
                const aiTemplate = aiScriptAnalysisService.generateValidationTemplate(aiAnalysis, packageJson.name || 'unknown', 'ai-scripts');
                // Add AI template to suggested templates
                const suggestedTemplates = [...baseResult.suggestedTemplates];
                // Only add AI template if it has meaningful actions
                if (aiTemplate.actions.length > 0) {
                    suggestedTemplates.push(aiTemplate);
                    // Also add a detected tool for the AI analysis
                    baseResult.detectedTools.push({
                        name: 'ai-scripts',
                        version: '1.0.0',
                        packages: ['scripts'],
                        configFiles: ['package.json'],
                        availableScripts: packageJson.scripts,
                        packageManager: baseResult.detectedTools[0]?.packageManager || 'npm',
                        packagePath,
                    });
                }
                return {
                    ...baseResult,
                    suggestedTemplates,
                };
            }
            return baseResult;
        }
        catch (error) {
            console.error('[ToolDetectionService] Error in AI detection:', error);
            // Fall back to base detection
            return this.detectTools(packagePath);
        }
    }
}
// Export singleton instance
export const toolDetectionService = new ToolDetectionService();

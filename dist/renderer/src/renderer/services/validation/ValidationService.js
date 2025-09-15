import { toolDetectionService } from './ToolDetectionService';
import { getTemplate, builtInTemplates } from './templates';
import { configuredValidationService } from './ConfiguredValidationService';
export class ValidationService {
    validations = new Map();
    /**
     * Load configured validations for a workspace
     * This only loads validations that the user has explicitly configured
     */
    async loadConfiguredValidations(workspaceRoot) {
        this.validations.clear();
        try {
            // Get workspace config to check if we should use AI
            const workspaceConfig = await configuredValidationService.getWorkspaceConfig(workspaceRoot);
            const useAI = workspaceConfig?.settings.useAI || false;
            // Find all packages and detect tools
            const packages = await this.findPackages(workspaceRoot);
            const detectedToolsMap = new Map();
            for (const packageInfo of packages) {
                const packagePath = packageInfo.path
                    ? `${workspaceRoot}/${packageInfo.path}`
                    : workspaceRoot;
                // Detect tools in this package
                const detection = useAI
                    ? await toolDetectionService.detectToolsWithAI(packagePath)
                    : await toolDetectionService.detectTools(packagePath);
                detectedToolsMap.set(packagePath, detection.detectedTools);
            }
            // Build template map
            const templateMap = new Map();
            for (const template of builtInTemplates) {
                templateMap.set(template.id, template);
            }
            // Build validations from configured validations only
            const validations = await configuredValidationService.buildValidationsFromConfig(workspaceRoot, detectedToolsMap, templateMap);
            // Store validations
            for (const validation of validations) {
                this.validations.set(validation.id, validation);
            }
            return validations;
        }
        catch (error) {
            console.error('Error loading configured validations:', error);
            return [];
        }
    }
    /**
     * Detect available validations for a workspace (for configuration UI)
     * This detects all possible validations but doesn't load them
     */
    async detectAvailableValidations(workspaceRoot, useAI = false) {
        const results = [];
        try {
            const packages = await this.findPackages(workspaceRoot);
            for (const packageInfo of packages) {
                const packagePath = packageInfo.path
                    ? `${workspaceRoot}/${packageInfo.path}`
                    : workspaceRoot;
                const detection = useAI
                    ? await toolDetectionService.detectToolsWithAI(packagePath)
                    : await toolDetectionService.detectTools(packagePath);
                if (detection.suggestedTemplates.length > 0) {
                    results.push({
                        packagePath,
                        packageName: packageInfo.name,
                        availableTemplates: detection.suggestedTemplates,
                        detectedTools: detection.detectedTools,
                    });
                }
            }
            return results;
        }
        catch (error) {
            console.error('Error detecting available validations:', error);
            return [];
        }
    }
    /**
     * Get all validations
     */
    getValidations() {
        return Array.from(this.validations.values());
    }
    /**
     * Get validations for a specific directory
     */
    getValidationsForDirectory(directory) {
        return Array.from(this.validations.values()).filter((validation) => validation.packagePath === directory ||
            directory.startsWith(validation.packagePath));
    }
    /**
     * Run validation actions
     */
    async runValidation(request) {
        const validation = this.validations.get(request.validationId);
        if (!validation) {
            throw new Error(`Validation ${request.validationId} not found`);
        }
        const template = getTemplate(validation.templateId);
        if (!template) {
            throw new Error(`Template ${validation.templateId} not found`);
        }
        const results = [];
        const actionIds = request.actionIds || validation.availableActions;
        for (const actionId of actionIds) {
            const action = this.findAction(template, actionId);
            if (!action) {
                results.push({
                    actionId,
                    status: 'skipped',
                    error: 'Action not found',
                    timestamp: Date.now(),
                });
                continue;
            }
            try {
                // Generate context-aware command
                const command = await toolDetectionService.generateCommand(action.command, validation.detectedTool.packageManager, validation.packagePath, request.workingDirectory, action);
                console.log(`Running validation: ${action.name} - ${command}`);
                // Run the command
                const startTime = Date.now();
                const result = await window.electron.shell.runCommand(command, {
                    cwd: request.workingDirectory,
                    timeout: action.timeout || request.timeout || 60000,
                });
                const duration = Date.now() - startTime;
                if (result.success) {
                    results.push({
                        actionId,
                        status: 'success',
                        output: result.output,
                        duration,
                        timestamp: Date.now(),
                    });
                }
                else {
                    results.push({
                        actionId,
                        status: action.severity === 'error' ? 'failure' : 'warning',
                        output: result.output,
                        error: result.error,
                        duration,
                        timestamp: Date.now(),
                    });
                }
            }
            catch (error) {
                results.push({
                    actionId,
                    status: 'failure',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now(),
                });
            }
        }
        // Update last run
        validation.lastRun = {
            timestamp: Date.now(),
            results,
        };
        // Calculate summary
        const summary = {
            total: results.length,
            success: results.filter((r) => r.status === 'success').length,
            failure: results.filter((r) => r.status === 'failure').length,
            warning: results.filter((r) => r.status === 'warning').length,
            skipped: results.filter((r) => r.status === 'skipped').length,
        };
        return {
            validationId: request.validationId,
            results,
            summary,
        };
    }
    /**
     * Find packages in workspace
     */
    async findPackages(workspaceRoot) {
        console.log('[ValidationService] Finding packages in:', workspaceRoot);
        console.log('[ValidationService] window.electron available:', !!window.electron);
        console.log('[ValidationService] window.electron.fileSystem available:', !!window.electron?.fileSystem);
        console.log('[ValidationService] getFileStats available:', !!window.electron?.fileSystem?.getFileStats);
        const packages = [];
        try {
            // Always include root if it has package.json
            let rootPackageExists = false;
            const rootPackageJsonPath = `${workspaceRoot}/package.json`;
            console.log('[ValidationService] Checking for root package.json at:', rootPackageJsonPath);
            try {
                const stats = await window.electron.fileSystem.getFileStats(rootPackageJsonPath);
                rootPackageExists = stats && !stats.isDirectory;
                console.log('[ValidationService] Root package.json stats:', stats);
            }
            catch (e) {
                // File doesn't exist
                console.log('[ValidationService] Root package.json not found:', e);
                rootPackageExists = false;
            }
            if (rootPackageExists) {
                // Try to read package name
                let packageName = 'root';
                try {
                    const result = await window.electron.fileSystem.readFile(`${workspaceRoot}/package.json`);
                    if (result?.content) {
                        const packageJson = JSON.parse(result.content);
                        packageName = packageJson.name || 'root';
                    }
                }
                catch {
                    // Use default name
                }
                packages.push({
                    path: '',
                    name: packageName,
                    hasPackageJson: true,
                });
            }
            // Look for all directories with package.json files
            try {
                const rootEntries = await window.electron.fileSystem.readDirectory(workspaceRoot);
                for (const entry of rootEntries) {
                    if (entry.isDirectory &&
                        !entry.name.startsWith('.') &&
                        entry.name !== 'node_modules') {
                        const packageJsonPath = `${workspaceRoot}/${entry.name}/package.json`;
                        let exists = false;
                        try {
                            const stats = await window.electron.fileSystem.getFileStats(packageJsonPath);
                            exists = stats && !stats.isDirectory;
                        }
                        catch (e) {
                            // File doesn't exist
                            exists = false;
                        }
                        if (exists) {
                            // Try to read package name
                            let packageName = entry.name;
                            try {
                                const result = await window.electron.fileSystem.readFile(packageJsonPath);
                                if (result?.content) {
                                    const packageJson = JSON.parse(result.content);
                                    packageName = packageJson.name || entry.name;
                                }
                            }
                            catch {
                                // Use directory name
                            }
                            console.log('[ValidationService] Found package in directory:', entry.name, 'with name:', packageName);
                            packages.push({
                                path: entry.name,
                                name: packageName,
                                hasPackageJson: true,
                            });
                        }
                    }
                }
            }
            catch (error) {
                console.error('[ValidationService] Error scanning root directory:', error);
            }
            // Also look for common monorepo patterns for nested packages
            const monorepoPatterns = ['packages', 'apps', 'libs'];
            for (const pattern of monorepoPatterns) {
                const dirPath = `${workspaceRoot}/${pattern}`;
                try {
                    const files = await window.electron.fileSystem.readDirectory(dirPath);
                    for (const file of files) {
                        if (file.isDirectory) {
                            const packageJsonPath = `${dirPath}/${file.name}/package.json`;
                            let exists = false;
                            try {
                                const stats = await window.electron.fileSystem.getFileStats(packageJsonPath);
                                exists = stats && !stats.isDirectory;
                            }
                            catch (e) {
                                // File doesn't exist
                                exists = false;
                            }
                            if (exists) {
                                // Try to read package name
                                let packageName = file.name;
                                try {
                                    const result = await window.electron.fileSystem.readFile(packageJsonPath);
                                    if (result?.content) {
                                        const packageJson = JSON.parse(result.content);
                                        packageName = packageJson.name || file.name;
                                    }
                                }
                                catch {
                                    // Use directory name
                                }
                                packages.push({
                                    path: `${pattern}/${file.name}`,
                                    name: packageName,
                                    hasPackageJson: true,
                                });
                            }
                        }
                    }
                }
                catch {
                    // Directory doesn't exist, continue
                }
            }
            // Look for workspaces in package.json
            if (rootPackageExists) {
                try {
                    const result = await window.electron.fileSystem.readFile(`${workspaceRoot}/package.json`);
                    if (result?.content) {
                        const packageJson = JSON.parse(result.content);
                        if (packageJson.workspaces) {
                            // TODO: Handle workspace globs
                            console.log('Found workspaces:', packageJson.workspaces);
                        }
                    }
                }
                catch {
                    // Ignore errors
                }
            }
        }
        catch (error) {
            console.error('[ValidationService] Error finding packages:', error);
        }
        console.log('[ValidationService] Total packages found:', packages.length, packages);
        return packages;
    }
    /**
     * Test run a single validation action without persisting results
     */
    async testRunAction(packagePath, templateId, actionId, detectedTool, workingDirectory, selectedLayers) {
        const template = getTemplate(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }
        const action = this.findAction(template, actionId);
        if (!action) {
            return {
                actionId,
                status: 'skipped',
                error: 'Action not found',
                timestamp: Date.now(),
            };
        }
        try {
            // Ensure packagePath is absolute
            const absolutePackagePath = packagePath.startsWith('/')
                ? packagePath
                : `${workingDirectory}/${packagePath}`;
            // Generate context-aware command
            const command = await toolDetectionService.generateCommand(action.command, detectedTool.packageManager, absolutePackagePath, workingDirectory, action, selectedLayers);
            console.log(`[ValidationService] Test running validation:`, {
                actionName: action.name,
                command,
                workingDirectory,
                packagePath: absolutePackagePath,
                packageManager: detectedTool.packageManager,
            });
            // Run the command
            const startTime = Date.now();
            console.log(`[ValidationService] Executing command via IPC:`, {
                command,
                cwd: workingDirectory,
                timeout: action.timeout || 60000,
            });
            const result = await window.electron.shell.runCommand(command, {
                cwd: workingDirectory,
                timeout: action.timeout || 60000,
            });
            const duration = Date.now() - startTime;
            // Interpret exit code based on action configuration
            let status = 'failure';
            if (result.success || result.code === 0) {
                status = 'success';
            }
            else if (result.code !== undefined && result.code !== null) {
                // Check if exit code is defined as success or warning
                if (action.exitCodes?.success?.includes(result.code)) {
                    status = 'success';
                }
                else if (action.exitCodes?.warning?.includes(result.code)) {
                    status = 'warning';
                }
                else {
                    status = 'failure';
                }
            }
            return {
                actionId,
                status,
                output: result.output || '',
                error: result.error || result.stderr || '',
                duration,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            return {
                actionId,
                status: 'failure',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
            };
        }
    }
    /**
     * Find action in template
     */
    findAction(template, actionId) {
        for (const group of template.actions) {
            const action = group.items.find((a) => a.id === actionId);
            if (action)
                return action;
        }
        return null;
    }
}
// Export singleton instance
export const validationService = new ValidationService();

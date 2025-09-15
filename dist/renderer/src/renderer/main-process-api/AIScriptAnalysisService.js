import { aiService } from '../../main-process-api/AIService';
export class AIScriptAnalysisService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!AIScriptAnalysisService.instance) {
            AIScriptAnalysisService.instance = new AIScriptAnalysisService();
        }
        return AIScriptAnalysisService.instance;
    }
    /**
     * Analyze scripts using AI via IPC
     */
    async analyzeScripts(packageJson, packagePath, useLocalModel = false) {
        try {
            // Call the main process to perform AI analysis
            const result = await aiService.analyzePackageScripts({
                packageJson,
                packagePath,
                provider: useLocalModel ? 'ollama' : 'openrouter',
            });
            return result;
        }
        catch (error) {
            console.error('[AIScriptAnalysisService] Error analyzing scripts:', error);
            // Fallback to local analysis
            return this.localAnalysis(packageJson.scripts || {});
        }
    }
    /**
     * Generate validation template from analysis
     */
    generateValidationTemplate(analysis, packageName, toolName = 'custom') {
        // Map categories to ActionCategory type
        const mapToActionCategory = (category) => {
            const mapping = {
                build: 'build',
                test: 'correctness',
                lint: 'quality',
                typecheck: 'correctness',
                format: 'quality',
                security: 'security',
                analyze: 'performance',
                deploy: 'custom',
                dev: 'custom',
                clean: 'custom',
                docs: 'custom',
            };
            return mapping[category] || 'custom';
        };
        // Group actions by category
        const actionGroups = analysis.categories
            .map((category) => {
            const categoryActions = analysis.suggestedActions
                .filter((action) => category.scripts.includes(action.script))
                .map((action) => ({
                id: `${toolName}-${action.script}`,
                name: action.description,
                command: action.command,
                description: action.description,
                severity: action.severity,
                requiresScript: action.script,
                timeout: action.timeout,
            }));
            return {
                category: mapToActionCategory(category.category),
                items: categoryActions,
            };
        })
            .filter((group) => group.items.length > 0);
        return {
            id: `${packageName}-ai-validation`,
            name: `${packageName} Validation (AI Generated)`,
            description: `AI-generated validation template for ${packageName}`,
            tool: {
                name: toolName,
                type: 'other',
                packageMatchers: [packageName],
                configFiles: [],
            },
            actions: actionGroups,
            author: 'AI Script Analyzer',
            version: '1.0.0',
            tags: ['ai-generated', 'custom'],
        };
    }
    /**
     * Local analysis fallback
     */
    localAnalysis(scripts) {
        const categories = new Map();
        const suggestedActions = [];
        // Define patterns for categorization
        const patterns = {
            build: /^(build|compile|bundle|pack)/i,
            dev: /^(dev|start|serve|watch)/i,
            test: /^(test|spec|jest|vitest|mocha|cypress|e2e)/i,
            lint: /^(lint|eslint|tslint|stylelint)/i,
            typecheck: /^(type|typecheck|tsc)/i,
            format: /^(format|prettier|fmt)/i,
            clean: /^(clean|clear|reset|purge)/i,
            deploy: /^(deploy|release|publish|ship)/i,
            docs: /^(docs|documentation|typedoc|storybook)/i,
            analyze: /^(analyze|bundle-analyze|size|measure)/i,
            prepare: /^(prepare|prebuild|postinstall|preinstall)/i,
            validate: /^(validate|verify|check)/i,
        };
        // Categorize each script
        for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
            let matched = false;
            for (const [category, pattern] of Object.entries(patterns)) {
                if (pattern.test(scriptName) || scriptCommand.includes(category)) {
                    if (!categories.has(category)) {
                        categories.set(category, {
                            category,
                            description: this.getCategoryDescription(category),
                            scripts: [],
                        });
                    }
                    categories.get(category).scripts.push(scriptName);
                    // Create suggested action
                    suggestedActions.push({
                        script: scriptName,
                        command: this.generateCommand(scriptName),
                        description: this.getActionDescription(category, scriptName, scriptCommand),
                        severity: this.getSeverity(category),
                        timeout: this.getTimeout(category, scriptCommand),
                    });
                    matched = true;
                    break;
                }
            }
            // If no pattern matched, analyze the command itself
            if (!matched) {
                const category = this.inferCategoryFromCommand(scriptCommand);
                if (!categories.has(category)) {
                    categories.set(category, {
                        category,
                        description: this.getCategoryDescription(category),
                        scripts: [],
                    });
                }
                categories.get(category).scripts.push(scriptName);
                suggestedActions.push({
                    script: scriptName,
                    command: this.generateCommand(scriptName),
                    description: `Run ${scriptName}`,
                    severity: this.getSeverity(category),
                    timeout: this.getTimeout(category, scriptCommand),
                });
            }
        }
        return {
            categories: Array.from(categories.values()),
            suggestedActions,
        };
    }
    inferCategoryFromCommand(command) {
        const commandLower = command.toLowerCase();
        if (commandLower.includes('webpack') ||
            commandLower.includes('rollup') ||
            commandLower.includes('vite build')) {
            return 'build';
        }
        if (commandLower.includes('jest') ||
            commandLower.includes('mocha') ||
            commandLower.includes('vitest')) {
            return 'test';
        }
        if (commandLower.includes('eslint') || commandLower.includes('tslint')) {
            return 'lint';
        }
        if (commandLower.includes('prettier')) {
            return 'format';
        }
        if (commandLower.includes('tsc') || commandLower.includes('typescript')) {
            return 'typecheck';
        }
        return 'other';
    }
    generateCommand(scriptName) {
        // Use ${pm} placeholder to support different package managers
        return `\${pm} run ${scriptName}`;
    }
    getCategoryDescription(category) {
        const descriptions = {
            build: 'Build and compilation scripts',
            dev: 'Development server and watch scripts',
            test: 'Testing scripts',
            lint: 'Code quality and linting scripts',
            typecheck: 'Type checking scripts',
            format: 'Code formatting scripts',
            clean: 'Cleanup scripts',
            deploy: 'Deployment and release scripts',
            docs: 'Documentation generation',
            analyze: 'Code analysis and metrics',
            prepare: 'Setup and preparation scripts',
            validate: 'Validation and verification scripts',
            other: 'Miscellaneous scripts',
        };
        return descriptions[category] || 'Unknown category';
    }
    getActionDescription(category, scriptName, command) {
        // Try to extract more specific description from the command
        if (command.includes('--watch')) {
            return `Run ${scriptName} in watch mode`;
        }
        if (command.includes('--coverage')) {
            return `Run ${scriptName} with coverage`;
        }
        if (command.includes('--fix')) {
            return `Run ${scriptName} with auto-fix`;
        }
        const descriptions = {
            build: 'Build the project',
            dev: 'Start development server',
            test: 'Run tests',
            lint: 'Check code quality',
            typecheck: 'Check TypeScript types',
            format: 'Format code',
            clean: 'Clean build artifacts',
            deploy: 'Deploy the project',
            docs: 'Generate documentation',
            analyze: 'Analyze bundle size',
            prepare: 'Prepare project',
            validate: 'Validate project',
        };
        return descriptions[category] || `Run ${scriptName}`;
    }
    getSeverity(category) {
        const severities = {
            build: 'error',
            test: 'error',
            lint: 'warning',
            typecheck: 'warning',
            format: 'warning',
            validate: 'warning',
            dev: 'info',
            clean: 'info',
            deploy: 'info',
            docs: 'info',
            analyze: 'info',
            prepare: 'info',
        };
        return severities[category] || 'info';
    }
    getTimeout(category, command) {
        // Check for specific flags that might affect timeout
        if (command.includes('--watch') || command.includes('serve')) {
            return 10000; // Just 10 seconds to start watch mode
        }
        if (command.includes('--coverage')) {
            return 600000; // 10 minutes for coverage runs
        }
        const timeouts = {
            build: 180000, // 3 minutes
            test: 300000, // 5 minutes
            lint: 60000, // 1 minute
            typecheck: 120000, // 2 minutes
            format: 30000, // 30 seconds
            dev: 10000, // 10 seconds (just to start)
            clean: 30000, // 30 seconds
            deploy: 300000, // 5 minutes
            docs: 120000, // 2 minutes
            analyze: 180000, // 3 minutes
            prepare: 120000, // 2 minutes
            validate: 120000, // 2 minutes
        };
        return timeouts[category] || 60000; // Default 1 minute
    }
    /**
     * Check if AI providers are available
     */
    async checkAIAvailability() {
        try {
            const config = await window.mainProcess.store.get('aiConfiguration');
            const openrouterAvailable = config?.providers?.openrouter?.enabled &&
                !!config?.providers?.openrouter?.apiKey;
            const ollamaAvailable = config?.providers?.ollama?.enabled;
            let preferredProvider = null;
            if (config?.defaultProvider &&
                config?.providers[config.defaultProvider]?.enabled) {
                preferredProvider = config.defaultProvider;
            }
            else if (openrouterAvailable) {
                preferredProvider = 'openrouter';
            }
            else if (ollamaAvailable) {
                preferredProvider = 'ollama';
            }
            return {
                openrouter: openrouterAvailable,
                ollama: ollamaAvailable,
                preferredProvider,
            };
        }
        catch (error) {
            console.error('[AIScriptAnalysisService] Error checking AI availability:', error);
            return {
                openrouter: false,
                ollama: false,
                preferredProvider: null,
            };
        }
    }
}
export const aiScriptAnalysisService = AIScriptAnalysisService.getInstance();

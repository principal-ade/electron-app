import { v4 as uuidv4 } from 'uuid';
const STORAGE_KEY = 'validationConfigs';
const CURRENT_VERSION = 1;
export class ConfiguredValidationService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!ConfiguredValidationService.instance) {
            ConfiguredValidationService.instance = new ConfiguredValidationService();
        }
        return ConfiguredValidationService.instance;
    }
    /**
     * Get all configured validations for a workspace
     */
    async getConfiguredValidations(workspaceRoot) {
        try {
            const store = await this.loadStore();
            const config = store.workspaces[workspaceRoot];
            return config?.validations || [];
        }
        catch (error) {
            console.error('[ConfiguredValidationService] Error loading validations:', error);
            return [];
        }
    }
    /**
     * Get workspace configuration
     */
    async getWorkspaceConfig(workspaceRoot) {
        try {
            const store = await this.loadStore();
            return store.workspaces[workspaceRoot] || null;
        }
        catch (error) {
            console.error('[ConfiguredValidationService] Error loading workspace config:', error);
            return null;
        }
    }
    /**
     * Configure a validation for a package
     */
    async configureValidation(workspaceRoot, packagePath, templateId, enabledActions) {
        const store = await this.loadStore();
        // Ensure workspace config exists
        if (!store.workspaces[workspaceRoot]) {
            store.workspaces[workspaceRoot] = {
                workspaceRoot,
                validations: [],
                settings: {
                    autoDetect: false,
                    useAI: false,
                    runOnSave: false,
                },
                updatedAt: Date.now(),
            };
        }
        const config = store.workspaces[workspaceRoot];
        // Check if validation already exists
        const existingIndex = config.validations.findIndex((v) => v.packagePath === packagePath && v.templateId === templateId);
        const validation = {
            id: existingIndex >= 0 ? config.validations[existingIndex].id : uuidv4(),
            workspaceRoot,
            packagePath,
            templateId,
            enabled: true,
            enabledActions,
            createdAt: existingIndex >= 0
                ? config.validations[existingIndex].createdAt
                : Date.now(),
            updatedAt: Date.now(),
        };
        if (existingIndex >= 0) {
            config.validations[existingIndex] = validation;
        }
        else {
            config.validations.push(validation);
        }
        config.updatedAt = Date.now();
        await this.saveStore(store);
        return validation;
    }
    /**
     * Remove a configured validation
     */
    async removeValidation(workspaceRoot, validationId) {
        const store = await this.loadStore();
        const config = store.workspaces[workspaceRoot];
        if (!config)
            return;
        config.validations = config.validations.filter((v) => v.id !== validationId);
        config.updatedAt = Date.now();
        await this.saveStore(store);
    }
    /**
     * Update validation settings
     */
    async updateValidation(workspaceRoot, validationId, updates) {
        const store = await this.loadStore();
        const config = store.workspaces[workspaceRoot];
        if (!config)
            return;
        const index = config.validations.findIndex((v) => v.id === validationId);
        if (index >= 0) {
            config.validations[index] = {
                ...config.validations[index],
                ...updates,
                updatedAt: Date.now(),
            };
            config.updatedAt = Date.now();
            await this.saveStore(store);
        }
    }
    /**
     * Update workspace settings
     */
    async updateWorkspaceSettings(workspaceRoot, settings) {
        const store = await this.loadStore();
        if (!store.workspaces[workspaceRoot]) {
            store.workspaces[workspaceRoot] = {
                workspaceRoot,
                validations: [],
                settings: {
                    autoDetect: false,
                    useAI: false,
                    runOnSave: false,
                },
                updatedAt: Date.now(),
            };
        }
        const config = store.workspaces[workspaceRoot];
        config.settings = { ...config.settings, ...settings };
        config.updatedAt = Date.now();
        await this.saveStore(store);
    }
    /**
     * Convert detected tools to PackageValidations based on configured validations
     */
    async buildValidationsFromConfig(workspaceRoot, detectedTools, templates) {
        const configuredValidations = await this.getConfiguredValidations(workspaceRoot);
        const validations = [];
        for (const configured of configuredValidations) {
            if (!configured.enabled)
                continue;
            const template = templates.get(configured.templateId);
            if (!template)
                continue;
            const toolsForPackage = detectedTools.get(configured.packagePath) || [];
            const tool = toolsForPackage.find((t) => t.name === template.tool.name);
            if (!tool)
                continue;
            // Build available actions based on configuration
            const availableActions = configured.enabledActions ||
                template.actions.flatMap((group) => group.items.map((item) => item.id));
            const validation = {
                id: configured.id,
                packagePath: configured.packagePath,
                templateId: configured.templateId,
                detectedTool: tool,
                availableActions,
                customOverrides: configured.commandOverrides,
            };
            validations.push(validation);
        }
        return validations;
    }
    /**
     * Check if a validation is configured
     */
    async isValidationConfigured(workspaceRoot, packagePath, templateId) {
        const configured = await this.getConfiguredValidations(workspaceRoot);
        return configured.some((v) => v.packagePath === packagePath &&
            v.templateId === templateId &&
            v.enabled);
    }
    /**
     * Load store from storage
     */
    async loadStore() {
        try {
            const stored = await window.mainProcess.store.get(STORAGE_KEY);
            if (stored && stored.version === CURRENT_VERSION) {
                return stored;
            }
        }
        catch (error) {
            console.error('[ConfiguredValidationService] Error loading store:', error);
        }
        // Return empty store
        return {
            version: CURRENT_VERSION,
            workspaces: {},
        };
    }
    /**
     * Save store to storage
     */
    async saveStore(store) {
        try {
            await window.mainProcess.store.set(STORAGE_KEY, store);
        }
        catch (error) {
            console.error('[ConfiguredValidationService] Error saving store:', error);
            throw error;
        }
    }
    /**
     * Clear all configurations for a workspace
     */
    async clearWorkspaceConfig(workspaceRoot) {
        const store = await this.loadStore();
        delete store.workspaces[workspaceRoot];
        await this.saveStore(store);
    }
    /**
     * Export workspace configuration
     */
    async exportWorkspaceConfig(workspaceRoot) {
        return this.getWorkspaceConfig(workspaceRoot);
    }
    /**
     * Import workspace configuration
     */
    async importWorkspaceConfig(config) {
        const store = await this.loadStore();
        store.workspaces[config.workspaceRoot] = config;
        await this.saveStore(store);
    }
}
export const configuredValidationService = ConfiguredValidationService.getInstance();

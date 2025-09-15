"use strict";
/**
 * ConfigValidator - Validates configuration structures
 * Ensures configs match expected schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigValidator = void 0;
class ConfigValidator {
    /**
     * Validate a configuration against its schema
     */
    static validate(configType, data) {
        switch (configType) {
            case 'scanFilters':
                return this.validateScanFilters(data);
            case 'defaultLayers':
                return this.validateDefaultLayers(data);
            case 'layerTemplates':
                return this.validateLayerTemplates(data);
            default:
                return false;
        }
    }
    /**
     * Validate scan filters configuration
     */
    static validateScanFilters(data) {
        if (!data || typeof data !== 'object')
            return false;
        const config = data;
        // Check required fields
        if (!config.version || typeof config.version !== 'string')
            return false;
        if (!Array.isArray(config.filters))
            return false;
        // Validate each filter
        for (const filter of config.filters) {
            if (!filter.id || typeof filter.id !== 'string')
                return false;
            if (!filter.name || typeof filter.name !== 'string')
                return false;
            if (typeof filter.enabled !== 'boolean')
                return false;
            if (!['performance', 'security', 'relevance'].includes(filter.purpose))
                return false;
            // Validate patterns
            if (!Array.isArray(filter.patterns))
                return false;
            for (const pattern of filter.patterns) {
                if (!['glob', 'regex', 'exact'].includes(pattern.type))
                    return false;
                if (!pattern.pattern || typeof pattern.pattern !== 'string')
                    return false;
            }
            // Validate optional warning
            if (filter.generateWarning) {
                const warning = filter.generateWarning;
                if (!warning.layerId || !warning.layerName)
                    return false;
                if (!['error', 'warning', 'info'].includes(warning.severity))
                    return false;
                if (!warning.message)
                    return false;
            }
        }
        return true;
    }
    /**
     * Validate default layers configuration
     */
    static validateDefaultLayers(data) {
        if (!data || typeof data !== 'object')
            return false;
        const config = data;
        // Check required fields
        if (!config.version || typeof config.version !== 'string')
            return false;
        // Config can have either flat layers array or sectioned structure
        const hasLayers = Array.isArray(config.layers);
        const hasSections = config.repositoryWide || config.workspaceScoped;
        if (!hasLayers && !hasSections)
            return false;
        // Validate flat layers if present
        if (hasLayers) {
            for (const layer of config.layers) {
                if (!this.validateLayerDefinition(layer))
                    return false;
            }
        }
        // Validate sections if present
        if (config.repositoryWide) {
            if (!Array.isArray(config.repositoryWide))
                return false;
            for (const section of config.repositoryWide) {
                if (!this.validateLayerSection(section))
                    return false;
            }
        }
        if (config.workspaceScoped) {
            if (!Array.isArray(config.workspaceScoped))
                return false;
            for (const section of config.workspaceScoped) {
                if (!this.validateLayerSection(section))
                    return false;
            }
        }
        return true;
    }
    /**
     * Validate layer templates configuration
     */
    static validateLayerTemplates(data) {
        if (!data || typeof data !== 'object')
            return false;
        const config = data;
        // Check required fields
        if (!config.version || typeof config.version !== 'string')
            return false;
        if (!Array.isArray(config.templates))
            return false;
        // Validate each template
        for (const template of config.templates) {
            if (!template.id || typeof template.id !== 'string')
                return false;
            if (!template.name || typeof template.name !== 'string')
                return false;
            if (!template.description || typeof template.description !== 'string')
                return false;
            if (!template.sourceFile || typeof template.sourceFile !== 'string')
                return false;
            // Validate content parser
            if (!['json', 'yaml', 'toml', 'text'].includes(template.contentParser)) {
                return false;
            }
            // Validate layer template
            if (!template.layerTemplate || typeof template.layerTemplate !== 'object') {
                return false;
            }
            if (!template.layerTemplate.type || !template.layerTemplate.category) {
                return false;
            }
            // Validate output mapping
            if (!Array.isArray(template.outputMapping))
                return false;
            for (const mapping of template.outputMapping) {
                if (!mapping.layerProperty || !mapping.sourceProperty)
                    return false;
            }
        }
        return true;
    }
    // Helper validators
    static validateLayerDefinition(layer) {
        if (!layer.id || typeof layer.id !== 'string')
            return false;
        if (!layer.name || typeof layer.name !== 'string')
            return false;
        if (!layer.type || typeof layer.type !== 'string')
            return false;
        if (!layer.category || typeof layer.category !== 'string')
            return false;
        // Validate patterns
        if (!Array.isArray(layer.patterns))
            return false;
        for (const pattern of layer.patterns) {
            if (!['glob', 'regex', 'exact'].includes(pattern.type))
                return false;
            if (!pattern.pattern || typeof pattern.pattern !== 'string')
                return false;
        }
        // Validate optional scope
        if (layer.scope && !['repository', 'workspace', 'directory'].includes(layer.scope)) {
            return false;
        }
        return true;
    }
    static validateLayerSection(section) {
        if (!section.id || typeof section.id !== 'string')
            return false;
        if (!section.name || typeof section.name !== 'string')
            return false;
        if (!Array.isArray(section.layers))
            return false;
        for (const layer of section.layers) {
            if (!this.validateLayerDefinition(layer))
                return false;
        }
        return true;
    }
}
exports.ConfigValidator = ConfigValidator;

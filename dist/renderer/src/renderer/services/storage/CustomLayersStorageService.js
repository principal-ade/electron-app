const CUSTOM_LAYERS_KEY_PREFIX = 'customArchitectureLayers';
const DEFAULT_STORED_LAYERS = {
    layers: [],
    version: 1,
};
export class CustomLayersStorageService {
    static getProjectKey(projectPath) {
        // Create a safe key by encoding the project path
        // This ensures the key is unique per project
        const encodedPath = btoa(projectPath).replace(/[^a-zA-Z0-9]/g, '_');
        return `${CUSTOM_LAYERS_KEY_PREFIX}:${encodedPath}`;
    }
    static async getCustomLayers(projectPath) {
        try {
            const key = this.getProjectKey(projectPath);
            const stored = await window.mainProcess.store.get(key);
            if (stored && typeof stored === 'object' && 'layers' in stored) {
                const data = stored;
                // Ensure all layers have the custom- prefix
                return data.layers.filter((layer) => layer.id.startsWith('custom-'));
            }
        }
        catch (error) {
            console.error('Error reading custom layers from electron store:', error);
        }
        return DEFAULT_STORED_LAYERS.layers;
    }
    static async saveCustomLayers(projectPath, layers) {
        try {
            const key = this.getProjectKey(projectPath);
            // Only save custom layers (those with custom- prefix)
            const customLayers = layers.filter((layer) => layer.id.startsWith('custom-'));
            const data = {
                layers: customLayers,
                version: 1,
            };
            await window.mainProcess.store.set(key, data);
        }
        catch (error) {
            console.error('Error saving custom layers to electron store:', error);
        }
    }
    static async addOrUpdateLayer(projectPath, layer) {
        try {
            const layers = await this.getCustomLayers(projectPath);
            const existingIndex = layers.findIndex((l) => l.id === layer.id);
            if (existingIndex >= 0) {
                layers[existingIndex] = layer;
            }
            else {
                layers.push(layer);
            }
            await this.saveCustomLayers(projectPath, layers);
        }
        catch (error) {
            console.error('Error adding/updating custom layer:', error);
        }
    }
    static async deleteLayer(projectPath, layerId) {
        try {
            const layers = await this.getCustomLayers(projectPath);
            const filtered = layers.filter((layer) => layer.id !== layerId);
            await this.saveCustomLayers(projectPath, filtered);
        }
        catch (error) {
            console.error('Error deleting custom layer:', error);
        }
    }
    static async clearAllCustomLayers(projectPath) {
        try {
            const key = this.getProjectKey(projectPath);
            await window.mainProcess.store.set(key, DEFAULT_STORED_LAYERS);
        }
        catch (error) {
            console.error('Error clearing custom layers:', error);
        }
    }
}

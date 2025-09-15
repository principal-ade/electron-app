import { HighlightLayer } from "@principal-ai/code-city-react";
export interface StoredCustomLayers {
    layers: HighlightLayer[];
    version: number;
}
export declare class CustomLayersStorageService {
    private static getProjectKey;
    static getCustomLayers(projectPath: string): Promise<HighlightLayer[]>;
    static saveCustomLayers(projectPath: string, layers: HighlightLayer[]): Promise<void>;
    static addOrUpdateLayer(projectPath: string, layer: HighlightLayer): Promise<void>;
    static deleteLayer(projectPath: string, layerId: string): Promise<void>;
    static clearAllCustomLayers(projectPath: string): Promise<void>;
}
//# sourceMappingURL=CustomLayersStorageService.d.ts.map
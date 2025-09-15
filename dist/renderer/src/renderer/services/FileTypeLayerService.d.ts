import { HighlightLayer, LayerRenderStrategy } from "@principal-ai/code-city-react";
export interface FileTypeLayerDefinition {
    id: string;
    name: string;
    description: string;
    fileExtensions: string[];
    color: string;
    renderStrategy: LayerRenderStrategy;
    icon?: string;
    priority?: number;
    opacity?: number;
    borderWidth?: number;
}
export interface FileInfo {
    path: string;
    fileExtension?: string;
}
export declare class FileTypeLayerService {
    private static fileTypeDefinitions;
    static getAvailableFileTypeLayers(): FileTypeLayerDefinition[];
    static getDefinitionById(id: string): FileTypeLayerDefinition | undefined;
    static createLayerFromDefinition(definition: FileTypeLayerDefinition, files: FileInfo[]): HighlightLayer;
    static createCustomFileTypeLayer(name: string, extensions: string[], color: string, renderStrategy: LayerRenderStrategy, files: FileInfo[]): HighlightLayer;
    static suggestLayersForProject(files: FileInfo[]): FileTypeLayerDefinition[];
}
//# sourceMappingURL=FileTypeLayerService.d.ts.map
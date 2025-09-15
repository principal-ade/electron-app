import { ExcalidrawDiagram } from '../../shared/main-process-api-interfaces/ExcalidrawAPI';
declare class ExcalidrawHandlers {
    private storageDir;
    private indexPath;
    private index;
    constructor();
    private initialize;
    private loadIndex;
    private recoverIndexFromFiles;
    private saveIndex;
    private getProjectHash;
    private getDiagramPath;
    saveDiagram(event: any, diagram: ExcalidrawDiagram): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    loadDiagram(event: any, diagramId: string): Promise<{
        success: boolean;
        data: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    listDiagrams(event: any, projectPath?: string): Promise<{
        success: boolean;
        data: {
            id: any;
            name: any;
            projectPath: any;
            isRepoAgnostic: any;
            createdAt: Date;
            updatedAt: Date;
        }[];
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    deleteDiagram(event: any, diagramId: string): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    exportDiagram(event: any, diagramId: string, format: 'png' | 'svg' | 'json'): Promise<{
        success: boolean;
        data: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        data?: undefined;
    }>;
    registerHandlers(): void;
}
export declare const excalidrawHandlers: ExcalidrawHandlers;
export {};
//# sourceMappingURL=excalidrawHandlers.d.ts.map
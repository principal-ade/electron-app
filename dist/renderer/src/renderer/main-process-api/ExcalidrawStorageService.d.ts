import { ExcalidrawDiagram, ExcalidrawDiagramData } from '../../shared/main-process-api-interfaces/ExcalidrawAPI';
export interface DiagramListItem {
    id: string;
    name: string;
    projectPath?: string;
    isRepoAgnostic: boolean;
    createdAt: Date;
    updatedAt: Date;
    thumbnail?: string;
}
export declare class ExcalidrawStorageService {
    static saveDiagram(name: string, data: ExcalidrawDiagramData, projectPath?: string, diagramId?: string): Promise<string>;
    static loadDiagram(diagramId: string): Promise<ExcalidrawDiagram | null>;
    static listDiagrams(projectPath?: string): Promise<DiagramListItem[]>;
    static deleteDiagram(diagramId: string): Promise<void>;
    static exportDiagram(diagramId: string, format: 'png' | 'svg' | 'json'): Promise<Blob | null>;
    static generateThumbnail(elements: any[], appState: any): string | null;
    /**
     * Creates a default ExcalidrawDiagramData structure for new diagrams
     */
    static createDefaultDiagramData(): ExcalidrawDiagramData;
}
//# sourceMappingURL=ExcalidrawStorageService.d.ts.map
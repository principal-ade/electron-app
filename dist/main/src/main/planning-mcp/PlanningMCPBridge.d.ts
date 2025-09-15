import { EventEmitter } from 'events';
interface SlideDocument {
    filePath: string;
    content: string;
    slides: string[];
    currentSlide: number;
    metadata: {
        title?: string;
        lastModified?: Date;
        totalSlides?: number;
    };
}
export declare class PlanningMCPBridge extends EventEmitter {
    private app;
    private server;
    private port;
    private documents;
    private operationHistory;
    constructor(startPort?: number);
    private setupMiddleware;
    private parseSlides;
    private joinSlides;
    private loadDocument;
    private saveDocument;
    private recordOperation;
    private notifyWindows;
    private setupRoutes;
    start(): Promise<number>;
    stop(): void;
    getPort(): number;
    getDocuments(): Map<string, SlideDocument>;
}
export declare function getPlanningMCPBridge(): PlanningMCPBridge;
export declare function startPlanningMCPBridge(): Promise<number>;
export declare function stopPlanningMCPBridge(): void;
export {};
//# sourceMappingURL=PlanningMCPBridge.d.ts.map
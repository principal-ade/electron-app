import { EventEmitter } from 'events';
import { SlideDocumentManager } from './core/SlideDocumentManager';
/**
 * Refactored Planning MCP Bridge that uses the core SlideDocumentManager
 * This thin layer just handles HTTP requests and delegates to the core manager
 */
export declare class PlanningMCPBridgeRefactored extends EventEmitter {
    private app;
    private server;
    private port;
    private documentManager;
    constructor(startPort?: number);
    private setupMiddleware;
    private setupRoutes;
    start(): Promise<number>;
    stop(): void;
    getPort(): number;
    getDocumentManager(): SlideDocumentManager;
}
//# sourceMappingURL=PlanningMCPBridgeRefactored.d.ts.map
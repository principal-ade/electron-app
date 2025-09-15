import { SessionContext, CreateContextOptions } from '../types/sessionContext';
declare class SessionContextService {
    private readonly STORAGE_KEY;
    getContextsForDirectory(directory: string): Promise<SessionContext[]>;
    saveContext(directory: string, context: SessionContext): Promise<void>;
    deleteContext(directory: string, contextId: string): Promise<void>;
    createContextFromSession(options: CreateContextOptions): SessionContext;
    private generateContextName;
    searchContexts(directory: string, query: string): Promise<SessionContext[]>;
    getContextsByTags(directory: string, tags: string[]): Promise<SessionContext[]>;
}
export declare const sessionContextService: SessionContextService;
export {};
//# sourceMappingURL=sessionContextService.d.ts.map
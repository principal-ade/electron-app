/**
 * Renderer-side service for Alexandria repository management
 * Communicates with main process via IPC using window.mainProcess
 */
import type { AlexandriaEntry } from '@a24z/core-library';
export declare class AlexandriaService {
    static getRepositories(): Promise<AlexandriaEntry[]>;
    static getRepository(name: string): Promise<AlexandriaEntry | null>;
    static getRepositoryByPath(path: string): Promise<AlexandriaEntry | null>;
    static registerRepository(name: string, path: string): Promise<AlexandriaEntry>;
    static removeRepository(name: string): Promise<boolean>;
    static searchRepositories(query: string): Promise<AlexandriaEntry[]>;
    static getRepositoriesWithViews(): Promise<AlexandriaEntry[]>;
    static refreshRepository(name: string): Promise<AlexandriaEntry | null>;
    static getRepositoryCount(): Promise<number>;
}
//# sourceMappingURL=AlexandriaService.d.ts.map
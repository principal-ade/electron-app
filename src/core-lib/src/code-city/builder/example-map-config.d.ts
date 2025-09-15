/**
 * Example map configurations demonstrating the new map-based navigation system.
 * This file shows how to create linked maps with scoping and metadata.
 */
import { CodebaseView } from 'a24z-memory';
/**
 * Top-level overview map showing the entire project structure
 */
export declare const overviewMap: CodebaseView;
/**
 * Detailed frontend map - focused on frontend directory only
 */
export declare const frontendDetailMap: CodebaseView;
/**
 * Backend detail map - focused on backend architecture
 */
export declare const backendDetailMap: CodebaseView;
/**
 * Example map demonstrating negation pattern support for filtering files
 * This is useful for focusing on production code without test files
 */
export declare const productionCodeMap: CodebaseView;
/**
 * Example map registry for managing multiple maps
 */
export declare class MapRegistry {
    private maps;
    constructor();
    register(config: CodebaseView): void;
    get(id: string): CodebaseView | undefined;
    getAll(): CodebaseView[];
    /**
     * Find all maps that link to a given map ID
     */
    findLinksTo(targetId: string): Array<{
        map: CodebaseView;
        cell: string;
    }>;
    /**
     * Get navigation breadcrumbs from one map to another
     */
    getNavigationPath(fromId: string, toId: string): string[];
}
export declare function demonstrateMapNavigation(): void;
//# sourceMappingURL=example-map-config.d.ts.map
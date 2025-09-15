import type { PackageLayer, PackageCommand } from "@principal-ai/codebase-composition";
import { FileOperation } from "../main-process-api/AgentSessionService";
/**
 * Represents a project/package that was touched by an agent session
 */
export interface TouchedProject {
    /** Package name */
    name: string;
    /** Package directory path (relative to repo root) */
    path: string;
    /** Package manager type */
    packageManager: string;
    /** Files touched in this project */
    touchedFiles: string[];
    /** Operation types performed (read, write, edit) */
    operationTypes: Set<string>;
    /** File count for this project */
    fileCount: number;
    /** Whether any files were written/edited (vs just read) */
    hasWrites: boolean;
    /** Available commands for this package (first 5) */
    availableCommands?: PackageCommand[];
}
/**
 * Maps file operations from a session to architecture projects/packages
 * @param fileOperations - Map of file operations from AgentSessionService.extractFileOperations
 * @param packageLayers - Package layers from architecture analysis
 * @param repositoryPath - Repository root path for normalization (optional)
 * @returns Array of projects touched by the session
 */
export declare function mapFileOperationsToProjects(fileOperations: Map<string, FileOperation>, packageLayers: PackageLayer[] | null | undefined, repositoryPath?: string): TouchedProject[];
/**
 * Gets a summary of touched projects for display
 * @param touchedProjects - Array of touched projects
 * @returns Summary object for UI display
 */
export declare function getTouchedProjectsSummary(touchedProjects: TouchedProject[]): {
    totalProjects: number;
    totalFiles: number;
    projectsWithWrites: number;
    projectsReadOnly: number;
    hasActivity: boolean;
};
//# sourceMappingURL=sessionProjectMapping.d.ts.map
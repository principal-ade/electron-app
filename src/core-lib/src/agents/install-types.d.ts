/**
 * Agent distribution and installation type definitions
 */
/**
 * Where the agent is distributed from
 */
type DistributionSource = 'github-release' | 'npm-registry' | 'custom-installer' | 'homebrew' | 'direct-download';
/**
 * The type of artifact being distributed
 */
type ArtifactType = 'native-binary' | 'node-module-esm' | 'node-module-cjs' | 'python-package' | 'shell-script';
/**
 * Runtime requirements for the agent
 */
type RuntimeRequirement = 'node' | 'python' | 'deno' | 'bun' | 'none';
/**
 * Complete installation information
 */
export interface InstallationInfo {
    source: DistributionSource;
    artifactType: ArtifactType;
    runtime: RuntimeRequirement;
    githubRepo?: string;
    npmPackage?: string;
    brewFormula?: string;
    downloadUrl?: string;
    installerUrl?: string;
    binaryName?: string;
    commandName?: string;
    assetName?: string;
    requiresWrapper?: boolean;
    platformSpecific?: boolean;
}
/**
 * Helper to determine if an agent needs Node.js
 */
export declare function requiresNodeJs(info: InstallationInfo): boolean;
/**
 * Helper to determine if an agent is distributed as a binary
 */
export declare function isNativeBinary(info: InstallationInfo): boolean;
export {};
//# sourceMappingURL=install-types.d.ts.map
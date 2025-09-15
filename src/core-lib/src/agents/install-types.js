/**
 * Agent distribution and installation type definitions
 */
/**
 * Helper to determine if an agent needs Node.js
 */
export function requiresNodeJs(info) {
    return (info.runtime === 'node' ||
        info.artifactType === 'node-module-esm' ||
        info.artifactType === 'node-module-cjs');
}
/**
 * Helper to determine if an agent is distributed as a binary
 */
export function isNativeBinary(info) {
    return info.artifactType === 'native-binary';
}

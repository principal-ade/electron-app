"use strict";
/**
 * Agent distribution and installation type definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiresNodeJs = requiresNodeJs;
exports.isNativeBinary = isNativeBinary;
/**
 * Helper to determine if an agent needs Node.js
 */
function requiresNodeJs(info) {
    return (info.runtime === 'node' ||
        info.artifactType === 'node-module-esm' ||
        info.artifactType === 'node-module-cjs');
}
/**
 * Helper to determine if an agent is distributed as a binary
 */
function isNativeBinary(info) {
    return info.artifactType === 'native-binary';
}

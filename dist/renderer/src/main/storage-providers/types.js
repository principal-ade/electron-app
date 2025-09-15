/**
 * Supported storage provider types
 */
export var StorageProviderType;
(function (StorageProviderType) {
    StorageProviderType["ELECTRON_STORE"] = "electron-store";
    StorageProviderType["S3"] = "s3";
    StorageProviderType["MEMORY"] = "memory";
    StorageProviderType["FILE_SYSTEM"] = "filesystem";
})(StorageProviderType || (StorageProviderType = {}));
// StaticNamespaces enum has been moved to shared/types/namespaces.types.ts
export { StaticNamespaces } from '../../shared/types/namespaces.types';

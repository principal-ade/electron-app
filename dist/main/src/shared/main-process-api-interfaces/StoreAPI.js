/**
 * Namespace categories for organization
 */
export var NamespaceCategory;
(function (NamespaceCategory) {
    NamespaceCategory["CORE"] = "core";
    NamespaceCategory["AGENT_SESSION_EVENTS"] = "agent-session-events";
    NamespaceCategory["CACHE"] = "cache"; // Temporary/cache data
})(NamespaceCategory || (NamespaceCategory = {}));
export var StoreEvents;
(function (StoreEvents) {
    // Core CRUD operations
    StoreEvents["GET"] = "store:get";
    StoreEvents["SET"] = "store:set";
    StoreEvents["DELETE"] = "store:delete";
    StoreEvents["HAS"] = "store:has";
    StoreEvents["CLEAR"] = "store:clear";
    StoreEvents["KEYS"] = "store:keys";
    // Namespace management
    StoreEvents["LIST_NAMESPACES"] = "store:list-namespaces";
    StoreEvents["GET_FILE_PATH"] = "store:get-file-path";
    StoreEvents["GET_NAMESPACE_FILE_PATH"] = "store:get-namespace-file-path";
    StoreEvents["GET_STATS"] = "store:get-stats";
    StoreEvents["GET_NAMESPACE_STATS"] = "store:get-namespace-stats";
    // Session and fallback management
    StoreEvents["SCAN_HOOK_FALLBACK_FILES"] = "store:scan-hook-fallback-files";
    StoreEvents["GET_SESSION_STORAGE_METRICS"] = "store:get-session-storage-metrics";
    StoreEvents["CLEANUP_SESSION_STORAGE"] = "store:cleanup-session-storage";
    // Watch events
    StoreEvents["WATCH"] = "store:watch";
    StoreEvents["UNWATCH"] = "store:unwatch";
    StoreEvents["STORAGE_CHANGED"] = "store:storage-changed";
    // Migration
    StoreEvents["MIGRATE"] = "store:migrate";
})(StoreEvents || (StoreEvents = {}));

/**
 * Secrets API Interface
 * Manages encrypted environment variables and secrets for repositories
 */
/**
 * IPC event channels for secrets management
 */
export var SecretsEvents;
(function (SecretsEvents) {
    // Core operations
    SecretsEvents["STORE"] = "secrets:store";
    SecretsEvents["GET"] = "secrets:get";
    SecretsEvents["DELETE"] = "secrets:delete";
    SecretsEvents["EXISTS"] = "secrets:exists";
    SecretsEvents["LIST"] = "secrets:list";
    // Bulk operations
    SecretsEvents["UPDATE"] = "secrets:update";
    SecretsEvents["REMOVE_KEYS"] = "secrets:remove-keys";
    // Maintenance
    SecretsEvents["CLEAR_CACHE"] = "secrets:clear-cache";
})(SecretsEvents || (SecretsEvents = {}));

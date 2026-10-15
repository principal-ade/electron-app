/**
 * Starred Collections Types
 *
 * Type definitions for starred repository collections stored in S3.
 * Users can organize GitHub repositories and users into custom collections.
 */
// ============================================================================
// Error Types
// ============================================================================
/**
 * Custom error class for collection operations
 */
export class CollectionError extends Error {
    statusCode;
    code;
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'CollectionError';
    }
}
/**
 * Error codes used throughout the collections API
 */
export const ErrorCodes = {
    // Authentication errors (401)
    NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
    // Authorization errors (403)
    NOT_ORG_MEMBER: 'NOT_ORG_MEMBER',
    // Not found errors (404)
    NOT_FOUND: 'NOT_FOUND',
    COLLECTION_NOT_FOUND: 'COLLECTION_NOT_FOUND',
    REPO_NOT_FOUND_IN_COLLECTION: 'REPO_NOT_FOUND_IN_COLLECTION',
    USER_NOT_FOUND_IN_COLLECTION: 'USER_NOT_FOUND_IN_COLLECTION',
    // Duplicate errors (409)
    DUPLICATE_NAME: 'DUPLICATE_NAME',
    DUPLICATE_REPO: 'DUPLICATE_REPO',
    DUPLICATE_USER: 'DUPLICATE_USER',
    // Limit errors (400)
    MAX_COLLECTIONS_EXCEEDED: 'MAX_COLLECTIONS_EXCEEDED',
    MAX_REPOS_EXCEEDED: 'MAX_REPOS_EXCEEDED',
    MAX_USERS_EXCEEDED: 'MAX_USERS_EXCEEDED',
    // Validation errors (400)
    INVALID_COLLECTION_NAME: 'INVALID_COLLECTION_NAME',
    INVALID_ICON: 'INVALID_ICON',
    INVALID_VISIBILITY: 'INVALID_VISIBILITY',
    INVALID_OWNER_REPO: 'INVALID_OWNER_REPO',
    INVALID_LOGIN: 'INVALID_LOGIN',
    INVALID_REORDER_REQUEST: 'INVALID_REORDER_REQUEST',
    // Concurrency errors (409)
    ETAG_CONFLICT: 'ETAG_CONFLICT',
    MAX_RETRIES: 'MAX_RETRIES',
    // GitHub API errors (502)
    GITHUB_API_ERROR: 'GITHUB_API_ERROR',
    REPO_NOT_FOUND: 'REPO_NOT_FOUND',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    ORG_MEMBERSHIP_CHECK_FAILED: 'ORG_MEMBERSHIP_CHECK_FAILED',
    // S3 errors (500)
    S3_ERROR: 'S3_ERROR',
};

/**
 * Links API Interface
 * Manages repository links and bookmarks
 */

export interface RepositoryLink {
  id: string; // Unique identifier (UUID)
  label: string; // Display name for the link
  url: string; // The actual URL
  description?: string; // Optional description
  category?: string; // Optional category (e.g., "docs", "ci", "deployment")
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}

export interface LinkMetadata {
  repoId: string;
  repoPath: string;
  createdAt: number;
  updatedAt: number;
  linkCount: number;
}

export interface LinkOperationResult {
  success: boolean;
  error?: string;
  metadata?: LinkMetadata;
}

export interface LinkStoreRequest {
  repoId: string;
  repoPath: string;
  links: RepositoryLink[];
}

/**
 * IPC event channels for links management
 */
export enum LinksEvents {
  // Core operations
  STORE = 'links:store',
  DELETE = 'links:delete',
  EXISTS = 'links:exists',
  LIST = 'links:list',
  GET = 'links:get',

  // Single link operations
  ADD_LINK = 'links:add-link',
  UPDATE_LINK = 'links:update-link',
  REMOVE_LINK = 'links:remove-link',

  // Utility operations
  OPEN_LINK = 'links:open-link',
  COPY_LINK = 'links:copy-link',
}

/**
 * Links management API
 */
export interface LinksAPI {
  /**
   * Store/update all links for a repository
   */
  store: (request: LinkStoreRequest) => Promise<LinkOperationResult>;

  /**
   * Delete all links for a repository
   */
  delete: (repoId: string) => Promise<LinkOperationResult>;

  /**
   * Check if links exist for a repository
   */
  exists: (repoId: string) => Promise<boolean>;

  /**
   * List metadata for all stored links
   */
  list: () => Promise<LinkMetadata[]>;

  /**
   * Get all links for a repository
   */
  get: (repoId: string) => Promise<RepositoryLink[]>;

  /**
   * Add a single link to a repository
   */
  addLink: (
    repoId: string,
    link: Omit<RepositoryLink, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<LinkOperationResult>;

  /**
   * Update a single link
   */
  updateLink: (
    repoId: string,
    linkId: string,
    updates: Partial<RepositoryLink>
  ) => Promise<LinkOperationResult>;

  /**
   * Remove a single link
   */
  removeLink: (repoId: string, linkId: string) => Promise<LinkOperationResult>;

  /**
   * Open a link in the default browser
   */
  openLink: (url: string) => Promise<{ success: boolean; error?: string }>;

  /**
   * Copy a link to clipboard
   */
  copyLink: (url: string) => Promise<{ success: boolean; error?: string }>;
}

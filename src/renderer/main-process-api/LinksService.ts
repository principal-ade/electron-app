/**
 * Service layer for Links management functionality
 * ALL window.mainProcess.links calls MUST be encapsulated here
 */

import type {
  RepositoryLink,
  LinkMetadata,
  LinkStoreRequest,
  LinkOperationResult,
} from '../../shared/main-process-api-interfaces/LinksAPI';

export class LinksService {
  /**
   * Store all links for a repository
   */
  static async store(request: LinkStoreRequest): Promise<LinkOperationResult> {
    return window.mainProcess.links.store(request);
  }

  /**
   * Delete all links for a repository
   */
  static async delete(repoId: string): Promise<LinkOperationResult> {
    return window.mainProcess.links.delete(repoId);
  }

  /**
   * List all link metadata
   */
  static async list(): Promise<LinkMetadata[]> {
    return window.mainProcess.links.list();
  }

  /**
   * Check if links exist for a repository
   */
  static async exists(repoId: string): Promise<boolean> {
    return window.mainProcess.links.exists(repoId);
  }

  /**
   * Get all links for a repository
   */
  static async get(repoId: string): Promise<RepositoryLink[]> {
    return window.mainProcess.links.get(repoId);
  }

  /**
   * Add a single link
   */
  static async addLink(
    repoId: string,
    link: Omit<RepositoryLink, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<LinkOperationResult> {
    return window.mainProcess.links.addLink(repoId, link);
  }

  /**
   * Update a single link
   */
  static async updateLink(
    repoId: string,
    linkId: string,
    updates: Partial<RepositoryLink>,
  ): Promise<LinkOperationResult> {
    return window.mainProcess.links.updateLink(repoId, linkId, updates);
  }

  /**
   * Remove a single link
   */
  static async removeLink(
    repoId: string,
    linkId: string,
  ): Promise<LinkOperationResult> {
    return window.mainProcess.links.removeLink(repoId, linkId);
  }

  /**
   * Open a link in the default browser
   */
  static async openLink(
    url: string,
  ): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.links.openLink(url);
  }

  /**
   * Copy a link to clipboard
   */
  static async copyLink(
    url: string,
  ): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.links.copyLink(url);
  }
}

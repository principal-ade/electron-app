import { TypedMultiStoreWrapper } from '../../storage-providers/typed-multistore-wrapper';
import { StaticNamespaces } from '../../../shared/types/namespaces.types';
import { v4 as uuidv4 } from 'uuid';

export interface RepositoryLink {
  id: string;
  label: string;
  url: string;
  description?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LinkMetadata {
  repoId: string;
  repoPath: string;
  createdAt: number;
  updatedAt: number;
  linkCount: number;
}

export interface StoredLinks {
  links: RepositoryLink[];
  metadata: LinkMetadata;
}

export class LinksDomain {
  private auditLog: Array<{
    level: string;
    message: string;
    timestamp: number;
    data?: any;
  }> = [];

  constructor(private storage: TypedMultiStoreWrapper) {}

  private logAudit(level: string, message: string, data?: any): void {
    const entry = {
      level,
      message,
      timestamp: Date.now(),
      data,
    };
    this.auditLog.push(entry);
    console.log(
      `[LinksDomain Audit] ${level.toUpperCase()}: ${message}`,
      data || '',
    );

    if (this.auditLog.length > 100) {
      this.auditLog = this.auditLog.slice(-50);
    }
  }

  private validateLink(link: Partial<RepositoryLink>): boolean {
    if (
      !link.label ||
      typeof link.label !== 'string' ||
      link.label.trim().length === 0
    ) {
      return false;
    }
    if (
      !link.url ||
      typeof link.url !== 'string' ||
      link.url.trim().length === 0
    ) {
      return false;
    }
    // Basic URL validation
    try {
      new URL(link.url);
      return true;
    } catch {
      return false;
    }
  }

  async storeLinks(
    repoId: string,
    repoPath: string,
    links: RepositoryLink[],
  ): Promise<{ success: boolean; error?: string; metadata?: LinkMetadata }> {
    try {
      // Validate all links
      for (const link of links) {
        if (!this.validateLink(link)) {
          return {
            success: false,
            error: `Invalid link: ${link.label || 'unknown'}`,
          };
        }
      }

      const now = Date.now();

      // Get existing data to preserve createdAt
      const existingResult = await this.storage.get(
        repoId,
        StaticNamespaces.REPOSITORY_LINKS,
      );
      const existingData = existingResult.success
        ? existingResult.data
        : undefined;
      const existingCreatedAt = existingData?.metadata?.createdAt || now;

      const metadata: LinkMetadata = {
        repoId,
        repoPath,
        createdAt: existingCreatedAt,
        updatedAt: now,
        linkCount: links.length,
      };

      const storedData: StoredLinks = {
        links,
        metadata,
      };

      await this.storage.set(
        repoId,
        storedData,
        StaticNamespaces.REPOSITORY_LINKS,
      );

      this.logAudit('info', `Stored ${links.length} links for repository`, {
        repoId,
      });

      return { success: true, metadata };
    } catch (error: any) {
      this.logAudit('error', 'Failed to store links', {
        repoId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async getLinks(repoId: string): Promise<RepositoryLink[]> {
    try {
      const result = await this.storage.get(
        repoId,
        StaticNamespaces.REPOSITORY_LINKS,
      );
      const data = result.success ? result.data : undefined;

      if (!data) {
        return [];
      }

      this.logAudit('info', 'Retrieved links for repository', { repoId });
      return data.links || [];
    } catch (error: any) {
      this.logAudit('error', 'Failed to retrieve links', {
        repoId,
        error: error.message,
      });
      return [];
    }
  }

  async getLinksWithMetadata(repoId: string): Promise<StoredLinks | null> {
    try {
      const result = await this.storage.get(
        repoId,
        StaticNamespaces.REPOSITORY_LINKS,
      );
      const data = result.success ? result.data : undefined;
      return data || null;
    } catch (error: any) {
      this.logAudit('error', 'Failed to retrieve links with metadata', {
        repoId,
        error: error.message,
      });
      return null;
    }
  }

  async deleteLinks(repoId: string): Promise<void> {
    try {
      await this.storage.delete(repoId, StaticNamespaces.REPOSITORY_LINKS);
      this.logAudit('info', 'Deleted links for repository', { repoId });
    } catch (error: any) {
      this.logAudit('error', 'Failed to delete links', {
        repoId,
        error: error.message,
      });
      throw error;
    }
  }

  async hasLinks(repoId: string): Promise<boolean> {
    return await this.storage.has(repoId, StaticNamespaces.REPOSITORY_LINKS);
  }

  async getAllMetadata(): Promise<LinkMetadata[]> {
    try {
      const linksNamespace = this.storage.namespace(
        StaticNamespaces.REPOSITORY_LINKS,
      );
      const allData = await linksNamespace.getAll();

      const metadata: LinkMetadata[] = [];
      for (const repoId in allData) {
        if (allData[repoId]?.metadata) {
          metadata.push(allData[repoId].metadata);
        }
      }

      return metadata;
    } catch (error: any) {
      this.logAudit('error', 'Failed to get all metadata', {
        error: error.message,
      });
      return [];
    }
  }

  async addLink(
    repoId: string,
    link: Omit<RepositoryLink, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<{ success: boolean; error?: string; metadata?: LinkMetadata }> {
    try {
      if (!this.validateLink(link)) {
        return { success: false, error: 'Invalid link data' };
      }

      const now = Date.now();
      const newLink: RepositoryLink = {
        ...link,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
      };

      const existingLinks = await this.getLinks(repoId);
      const updatedLinks = [...existingLinks, newLink];

      const data = await this.getLinksWithMetadata(repoId);
      const repoPath = data?.metadata?.repoPath || '';

      return await this.storeLinks(repoId, repoPath, updatedLinks);
    } catch (error: any) {
      this.logAudit('error', 'Failed to add link', {
        repoId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async updateLink(
    repoId: string,
    linkId: string,
    updates: Partial<RepositoryLink>,
  ): Promise<{ success: boolean; error?: string; metadata?: LinkMetadata }> {
    try {
      const existingLinks = await this.getLinks(repoId);
      const linkIndex = existingLinks.findIndex((l) => l.id === linkId);

      if (linkIndex === -1) {
        return { success: false, error: 'Link not found' };
      }

      const updatedLink = {
        ...existingLinks[linkIndex],
        ...updates,
        id: linkId, // Ensure ID doesn't change
        updatedAt: Date.now(),
      };

      if (!this.validateLink(updatedLink)) {
        return { success: false, error: 'Invalid link data' };
      }

      const updatedLinks = [...existingLinks];
      updatedLinks[linkIndex] = updatedLink;

      const data = await this.getLinksWithMetadata(repoId);
      const repoPath = data?.metadata?.repoPath || '';

      return await this.storeLinks(repoId, repoPath, updatedLinks);
    } catch (error: any) {
      this.logAudit('error', 'Failed to update link', {
        repoId,
        linkId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async removeLink(
    repoId: string,
    linkId: string,
  ): Promise<{ success: boolean; error?: string; metadata?: LinkMetadata }> {
    try {
      const existingLinks = await this.getLinks(repoId);
      const updatedLinks = existingLinks.filter((l) => l.id !== linkId);

      if (updatedLinks.length === existingLinks.length) {
        return { success: false, error: 'Link not found' };
      }

      const data = await this.getLinksWithMetadata(repoId);
      const repoPath = data?.metadata?.repoPath || '';

      return await this.storeLinks(repoId, repoPath, updatedLinks);
    } catch (error: any) {
      this.logAudit('error', 'Failed to remove link', {
        repoId,
        linkId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  getAuditLog(): Array<{
    level: string;
    message: string;
    timestamp: number;
    data?: any;
  }> {
    return [...this.auditLog];
  }
}

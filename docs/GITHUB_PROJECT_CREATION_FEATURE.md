# GitHub Repository Creation Feature

## Overview

This document outlines the implementation of GitHub repository creation functionality within the GitHub Projects Panel. Users will be able to create new GitHub repositories programmatically through the GitHub API directly from the Alexandria interface.

## Feature Requirements

### User Experience

1. **Create Repository Button** at each organization divider
   - Placed next to organization name in the collapsible header
   - Visible when organization section is expanded
   - Clear visual indicator (+ icon or "Create Repository" button)

2. **Modal Flow** for repository creation
   - Repository Details
     - Repository name (required)
     - Description (optional)
     - Visibility (Public/Private)
     - Initialize options:
       - Add README
       - Add .gitignore (with template selection)
       - Add license (with license selection)
   - Confirmation
     - Review details
     - Create or cancel
   - Success/Error feedback
     - Show repository URL
     - Option to clone locally

3. **Real-time Updates**
   - Newly created repository appears in the panel immediately
   - No manual refresh required

### Current Context

**Panel Location**: `src/renderer/panels/components/GitHubProjectsPanel.tsx`

The panel currently:
- Groups repositories by organization (lines 178-200)
- Displays collapsible organization sections (lines 410-494)
- Shows organization name and repository count (lines 458-477)
- Uses `GithubService` for API calls (line 119)

## GitHub API for Repository Creation

GitHub provides a REST API for creating repositories in organizations and user accounts.

### Create Repository API

**Type**: REST API
**Endpoints**:
- Organization Repository: `POST /orgs/{org}/repos`
- User Repository: `POST /user/repos`

**Request Body (Organization)**:
```json
{
  "name": "my-new-repo",
  "description": "This is a new repository",
  "private": false,
  "auto_init": true,
  "gitignore_template": "Node",
  "license_template": "mit"
}
```

**Request Body (User)**:
```json
{
  "name": "my-new-repo",
  "description": "This is a new repository",
  "private": false,
  "auto_init": true,
  "gitignore_template": "Node",
  "license_template": "mit"
}
```

**Response**:
```json
{
  "id": 123456789,
  "node_id": "MDEwOlJlcG9zaXRvcnkxMjM0NTY3ODk=",
  "name": "my-new-repo",
  "full_name": "organization/my-new-repo",
  "owner": {
    "login": "organization",
    "id": 12345,
    "type": "Organization"
  },
  "private": false,
  "html_url": "https://github.com/organization/my-new-repo",
  "description": "This is a new repository",
  "clone_url": "https://github.com/organization/my-new-repo.git",
  "ssh_url": "git@github.com:organization/my-new-repo.git",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z",
  "default_branch": "main"
}
```

**Required Permissions**:
- `public_repo` (for creating public repositories)
- `repo` (for creating private repositories)

**Available Options**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | **Required**. The name of the repository |
| `description` | string | A short description of the repository |
| `homepage` | string | A URL with more information about the repository |
| `private` | boolean | Whether the repository is private. Default: `false` |
| `visibility` | string | Can be `public`, `private`, or `internal` |
| `has_issues` | boolean | Enable issues for this repository. Default: `true` |
| `has_projects` | boolean | Enable projects for this repository. Default: `true` |
| `has_wiki` | boolean | Enable the wiki for this repository. Default: `true` |
| `auto_init` | boolean | Create an initial commit with empty README. Default: `false` |
| `gitignore_template` | string | .gitignore template to use (e.g., "Node", "Python") |
| `license_template` | string | License template (e.g., "mit", "apache-2.0") |
| `allow_squash_merge` | boolean | Allow squash merging. Default: `true` |
| `allow_merge_commit` | boolean | Allow merge commits. Default: `true` |
| `allow_rebase_merge` | boolean | Allow rebase merging. Default: `true` |

**Popular .gitignore Templates**:
- Node
- Python
- Java
- Ruby
- Go
- Rust
- C++
- Swift
- Kotlin

**Popular License Templates**:
- mit
- apache-2.0
- gpl-3.0
- bsd-2-clause
- bsd-3-clause
- unlicense
- mpl-2.0
- lgpl-3.0

## Implementation Architecture

### Architecture Layers

```
┌───────────────────────────────────────────┐
│  GitHubProjectsPanel (React Component)    │  <- UI with create buttons
├───────────────────────────────────────────┤
│  CreateRepositoryModal (React Component)  │  <- Modal form UI
├───────────────────────────────────────────┤
│  GithubService (Renderer Service)         │  <- API abstraction
├───────────────────────────────────────────┤
│  githubAPI (IPC Implementation)           │  <- IPC bridge
├───────────────────────────────────────────┤
│  GithubHandler (Main Process)             │  <- GitHub REST API calls
└───────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Update GitHub API Interface

**File**: `src/shared/main-process-api-interfaces/GitHubAPI.ts`

Add new types and events:

```typescript
export interface CreateRepositoryInput {
  name: string;
  description?: string;
  private?: boolean;
  auto_init?: boolean;
  gitignore_template?: string;
  license_template?: string;
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  allow_squash_merge?: boolean;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
}

export interface GitHubRepositoryCreated extends GitHubRepository {
  // Inherits all GitHubRepository fields, plus:
  clone_url: string;
  ssh_url: string;
  git_url: string;
  created_at: string;
  updated_at: string;
  default_branch: string;
}

export enum GitHubAPIEvents {
  // ... existing events
  CREATE_REPOSITORY = 'github:createRepository',
  GET_GITIGNORE_TEMPLATES = 'github:getGitignoreTemplates',
  GET_LICENSE_TEMPLATES = 'github:getLicenseTemplates',
}

export interface GitHubAPI {
  // ... existing methods
  createRepository: (
    owner: string,
    input: CreateRepositoryInput,
    isOrganization: boolean
  ) => Promise<GitHubRepositoryCreated>;
  getGitignoreTemplates: () => Promise<string[]>;
  getLicenseTemplates: () => Promise<Array<{ key: string; name: string }>>;
}
```

### Step 2: Update GithubService

**File**: `src/renderer/main-process-api/GithubService.ts`

Add new methods:

```typescript
export class GithubService {
  // ... existing methods

  static async createRepository(
    owner: string,
    input: CreateRepositoryInput,
    isOrganization: boolean = true
  ): Promise<GitHubRepositoryCreated> {
    return window.mainProcess.github.createRepository(
      owner,
      input,
      isOrganization
    );
  }

  static async getGitignoreTemplates(): Promise<string[]> {
    return window.mainProcess.github.getGitignoreTemplates();
  }

  static async getLicenseTemplates(): Promise<
    Array<{ key: string; name: string }>
  > {
    return window.mainProcess.github.getLicenseTemplates();
  }
}
```

### Step 3: Update IPC Implementation

**File**: `src/window/main-process-api-implementations/githubApi.ts`

Add IPC handlers:

```typescript
import { GitHubAPIEvents } from '../../shared/main-process-api-interfaces/GitHubAPI';

export const githubAPI: GitHubAPI = {
  // ... existing methods

  createRepository: async (
    owner: string,
    input: CreateRepositoryInput,
    isOrganization: boolean
  ) => {
    return ipcRenderer.invoke(
      GitHubAPIEvents.CREATE_REPOSITORY,
      owner,
      input,
      isOrganization
    );
  },

  getGitignoreTemplates: async () => {
    return ipcRenderer.invoke(GitHubAPIEvents.GET_GITIGNORE_TEMPLATES);
  },

  getLicenseTemplates: async () => {
    return ipcRenderer.invoke(GitHubAPIEvents.GET_LICENSE_TEMPLATES);
  },
};
```

### Step 4: Update Main Process Handler

**File**: `src/main/github.ts`

Add handlers and REST API methods:

```typescript
import { ipcMain } from 'electron';
import { GitHubAPIEvents } from '../shared/main-process-api-interfaces/GitHubAPI';

class GithubHandler {
  constructor() {
    this.setupIPCHandlers();
  }

  private setupIPCHandlers() {
    // ... existing handlers

    ipcMain.handle(
      GitHubAPIEvents.CREATE_REPOSITORY,
      async (
        _event,
        owner: string,
        input: CreateRepositoryInput,
        isOrganization: boolean
      ) => this.createRepository(owner, input, isOrganization)
    );

    ipcMain.handle(
      GitHubAPIEvents.GET_GITIGNORE_TEMPLATES,
      async () => this.getGitignoreTemplates()
    );

    ipcMain.handle(
      GitHubAPIEvents.GET_LICENSE_TEMPLATES,
      async () => this.getLicenseTemplates()
    );
  }

  private async createRepository(
    owner: string,
    input: CreateRepositoryInput,
    isOrganization: boolean
  ): Promise<GitHubRepositoryCreated> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }

    // Determine endpoint based on organization vs user
    const endpoint = isOrganization
      ? `https://api.github.com/orgs/${owner}/repos`
      : `https://api.github.com/user/repos`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `GitHub API error: ${error.message || response.statusText}`
      );
    }

    return response.json();
  }

  private async getGitignoreTemplates(): Promise<string[]> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }

    const response = await fetch(
      'https://api.github.com/gitignore/templates',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async getLicenseTemplates(): Promise<
    Array<{ key: string; name: string }>
  > {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }

    const response = await fetch('https://api.github.com/licenses', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async getAccessToken(): Promise<string | null> {
    // Use existing authentication method
    // ... implementation depends on current auth setup
  }
}

export const githubHandler = new GithubHandler();
```

### Step 5: Create Modal Component

**File**: `src/renderer/panels/components/CreateGitHubRepositoryModal.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { GithubService } from '../../main-process-api/GithubService';
import type {
  CreateRepositoryInput,
  GitHubRepositoryCreated,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';

interface CreateGitHubRepositoryModalProps {
  organizationLogin: string;
  onClose: () => void;
  onSuccess: (repository: GitHubRepositoryCreated) => void;
}

export const CreateGitHubRepositoryModal: React.FC<
  CreateGitHubRepositoryModalProps
> = ({ organizationLogin, onClose, onSuccess }) => {
  const { theme } = useTheme();
  const [repositoryName, setRepositoryName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [autoInit, setAutoInit] = useState(true);
  const [gitignoreTemplate, setGitignoreTemplate] = useState('');
  const [licenseTemplate, setLicenseTemplate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available templates
  const [gitignoreTemplates, setGitignoreTemplates] = useState<string[]>([]);
  const [licenseTemplates, setLicenseTemplates] = useState<
    Array<{ key: string; name: string }>
  >([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // Load templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const [gitignores, licenses] = await Promise.all([
          GithubService.getGitignoreTemplates(),
          GithubService.getLicenseTemplates(),
        ]);
        setGitignoreTemplates(gitignores);
        setLicenseTemplates(licenses);
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

  const handleCreate = async () => {
    if (!repositoryName.trim()) {
      setError('Repository name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const input: CreateRepositoryInput = {
        name: repositoryName.trim(),
        description: description.trim() || undefined,
        private: isPrivate,
        auto_init: autoInit,
        gitignore_template: gitignoreTemplate || undefined,
        license_template: licenseTemplate || undefined,
      };

      const repository = await GithubService.createRepository(
        organizationLogin,
        input,
        true // isOrganization
      );

      onSuccess(repository);
      onClose();
    } catch (err) {
      console.error('Failed to create repository:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create repository. Please try again.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          width: '480px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: `${theme.fontSizes[3]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
            }}
          >
            Create GitHub Repository
          </h2>
          <button
            onClick={onClose}
            disabled={isCreating}
            style={{
              background: 'none',
              border: 'none',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: theme.colors.textSecondary,
              opacity: isCreating ? 0.5 : 1,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {/* Organization info */}
          <div style={{ marginBottom: '20px' }}>
            <p
              style={{
                margin: 0,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
              }}
            >
              Organization:{' '}
              <strong style={{ color: theme.colors.text }}>
                {organizationLogin}
              </strong>
            </p>
          </div>

          {/* Repository name input */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="repo-name"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              Repository Name *
            </label>
            <input
              id="repo-name"
              type="text"
              value={repositoryName}
              onChange={(e) => {
                setRepositoryName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              placeholder="my-awesome-repo"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${
                  error ? theme.colors.error || '#ef4444' : theme.colors.border
                }`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                outline: 'none',
              }}
            />
          </div>

          {/* Description input */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="description"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              placeholder="A short description of your repository"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Visibility */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                disabled={isCreating}
              />
              Private repository
            </label>
          </div>

          {/* Initialize repository */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              <input
                type="checkbox"
                checked={autoInit}
                onChange={(e) => setAutoInit(e.target.checked)}
                disabled={isCreating}
              />
              Initialize with README
            </label>
          </div>

          {/* .gitignore template */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="gitignore"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              .gitignore Template
            </label>
            <select
              id="gitignore"
              value={gitignoreTemplate}
              onChange={(e) => setGitignoreTemplate(e.target.value)}
              disabled={isCreating || isLoadingTemplates}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                outline: 'none',
              }}
            >
              <option value="">None</option>
              {gitignoreTemplates.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </div>

          {/* License template */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="license"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
              }}
            >
              License
            </label>
            <select
              id="license"
              value={licenseTemplate}
              onChange={(e) => setLicenseTemplate(e.target.value)}
              disabled={isCreating || isLoadingTemplates}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
                outline: 'none',
              }}
            >
              <option value="">None</option>
              {licenseTemplates.map((license) => (
                <option key={license.key} value={license.key}>
                  {license.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: `${theme.colors.error || '#ef4444'}20`,
                color: theme.colors.error || '#ef4444',
                fontSize: `${theme.fontSizes[1]}px`,
                fontFamily: theme.fonts.body,
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '16px 20px',
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          <button
            onClick={onClose}
            disabled={isCreating}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: 'transparent',
              color: theme.colors.text,
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              cursor: isCreating ? 'not-allowed' : 'pointer',
              opacity: isCreating ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !repositoryName.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              cursor:
                isCreating || !repositoryName.trim() ? 'not-allowed' : 'pointer',
              opacity: isCreating || !repositoryName.trim() ? 0.5 : 1,
            }}
          >
            {isCreating && <Loader2 size={16} className="animate-spin" />}
            {isCreating ? 'Creating...' : 'Create Repository'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

### Step 6: Update GitHubProjectsPanel

**File**: `src/renderer/panels/components/GitHubProjectsPanel.tsx`

Add modal state and button to organization headers:

```typescript
// Add imports
import { Plus } from 'lucide-react';
import { CreateGitHubRepositoryModal } from './CreateGitHubRepositoryModal';

export const GitHubProjectsPanel: React.FC = () => {
  // ... existing state

  // Add modal state
  const [createModalOrg, setCreateModalOrg] = useState<string | null>(null);

  // Add success handler
  const handleRepositoryCreated = useCallback((repository: GitHubRepositoryCreated) => {
    console.log('Repository created:', repository);
    // Optionally refresh the panel or show success notification
    void fetchRepositories();
  }, [fetchRepositories]);

  // In the organization header section (around line 416-478), add button:
  return (
    <div style={contentContainerStyle}>
      {/* ... existing search bar ... */}

      <div style={{ /* ... existing styles ... */ }}>
        {repositoriesByOrg.map(({ organization, repositories }) => {
          const sectionId = `org-${organization}`;
          const isCollapsed = collapsedSections.has(sectionId);

          return (
            <div key={organization}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <button
                  onClick={() => toggleSection(sectionId)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: theme.colors.background,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary ||
                      theme.colors.backgroundSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.background;
                  }}
                >
                  {/* ... existing content ... */}
                </button>

                {/* Create Repository Button */}
                <button
                  onClick={() => setCreateModalOrg(organization)}
                  title="Create GitHub Repository"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    backgroundColor: theme.colors.background,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: theme.colors.primary,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary ||
                      theme.colors.backgroundSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.background;
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* ... rest of organization section ... */}
            </div>
          );
        })}
      </div>

      {/* Create Repository Modal */}
      {createModalOrg && (
        <CreateGitHubRepositoryModal
          organizationLogin={createModalOrg}
          onClose={() => setCreateModalOrg(null)}
          onSuccess={handleRepositoryCreated}
        />
      )}
    </div>
  );
};
```

## Testing Checklist

### Manual Testing

- [ ] Button appears next to each organization name
- [ ] Button opens modal when clicked
- [ ] Modal displays organization name correctly
- [ ] Repository name input works correctly
- [ ] Description textarea works correctly
- [ ] Can toggle private/public visibility
- [ ] Can toggle initialize with README
- [ ] .gitignore template dropdown populates and works
- [ ] License template dropdown populates and works
- [ ] Validation shows error for empty name
- [ ] Can cancel modal (X button, Cancel button, ESC key)
- [ ] Can create repository (Enter key, Create button)
- [ ] Loading state shows during creation
- [ ] Success: modal closes and repository is created
- [ ] Error: error message displays appropriately
- [ ] Panel refreshes after successful creation
- [ ] Newly created repository appears in the list

### API Testing

- [ ] REST API call to create organization repository succeeds
- [ ] REST API call to get .gitignore templates succeeds
- [ ] REST API call to get license templates succeeds
- [ ] Repository created with correct name and description
- [ ] Private/public visibility set correctly
- [ ] README initialization works when enabled
- [ ] .gitignore template applied correctly
- [ ] License template applied correctly
- [ ] Authentication errors handled properly
- [ ] Network errors handled gracefully
- [ ] Rate limiting considered
- [ ] API response includes all expected fields (clone_url, ssh_url, etc.)

### Edge Cases

- [ ] Very long repository names (GitHub max is 100 characters)
- [ ] Special characters in repository names
- [ ] Duplicate repository names (should error)
- [ ] Network timeout during creation
- [ ] User has insufficient permissions
- [ ] Organization doesn't exist
- [ ] Invalid .gitignore template selected
- [ ] Invalid license template selected
- [ ] Creating private repo without proper permissions
- [ ] Repository name with invalid characters (spaces, special chars)

## Token Permissions

Ensure GitHub OAuth token has required scopes:

**For Creating Repositories**:
- `public_repo` - Grants access to create public repositories
- `repo` - Grants full access to private and public repositories (includes `public_repo`)
  - Required for creating private repositories
  - Required for full repository management

**For Organization Repositories**:
- User must be a member of the organization with appropriate permissions
- Organization must allow members to create repositories (check org settings)

**Check current permissions**:
```typescript
const response = await fetch('https://api.github.com/user', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const scopes = response.headers.get('x-oauth-scopes');
console.log('Available scopes:', scopes);
```

## Future Enhancements

1. **Repository Management**
   - Clone repository locally after creation
   - Open in editor after creation
   - Add to workspace automatically

2. **Advanced Configuration**
   - Team access settings
   - Branch protection rules
   - Webhooks configuration
   - Topics/tags

3. **Batch Operations**
   - Create multiple repositories at once
   - Import from template repositories
   - Fork existing repositories

4. **Templates**
   - Save repository creation templates
   - Quick create from custom templates
   - Organization-wide default templates

5. **Notifications**
   - Toast notifications for success/error
   - Progress tracking for long operations
   - Background repository creation

6. **Integration**
   - Automatic git initialization in local directory
   - Setup CI/CD workflows (GitHub Actions)
   - Connect to project management tools

## References

- [GitHub REST API - Create Repository](https://docs.github.com/en/rest/repos/repos#create-an-organization-repository)
- [GitHub REST API - Create Repository for User](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user)
- [GitHub REST API - Get .gitignore Templates](https://docs.github.com/en/rest/gitignore#get-all-gitignore-templates)
- [GitHub REST API - Get License Templates](https://docs.github.com/en/rest/licenses#get-all-commonly-used-licenses)
- [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [Repository Naming Guidelines](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories#repository-name-guidelines)

## Implementation Files

```
src/
├── shared/
│   └── main-process-api-interfaces/
│       └── GitHubAPI.ts                          [UPDATE]
├── renderer/
│   ├── main-process-api/
│   │   └── GithubService.ts                      [UPDATE]
│   └── panels/
│       └── components/
│           ├── GitHubProjectsPanel.tsx           [UPDATE]
│           └── CreateGitHubRepositoryModal.tsx   [NEW]
└── window/
    └── main-process-api-implementations/
        └── githubApi.ts                           [UPDATE]

src/main/
└── github.ts                                      [UPDATE]
```

## Getting Started

1. Review GitHub API documentation
2. Implement Step 1 (API interface)
3. Implement Steps 2-4 (IPC layer)
4. Implement Step 5 (Modal component)
5. Implement Step 6 (Panel integration)
6. Test with real GitHub account
7. Handle edge cases
8. Add error handling
9. Polish UI/UX

Good luck with implementation!

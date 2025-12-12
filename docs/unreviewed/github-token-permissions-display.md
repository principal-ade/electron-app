# GitHub Token Permissions Display Plan

> **Note**: This application uses WorkOS for authentication with GitHub as the identity provider. WorkOS returns a GitHub access token that can be used with the GitHub API. This document describes how to display the permissions and capabilities of that GitHub token.

## Current State

The AuthView shows:
- User information (name, login, email, avatar)
- Authentication status
- Organizations derived from locally cloned repositories

**Missing**: The actual GitHub token permissions and which organizations the token can access.

## What We Need to Display

### 1. Token Scopes
The OAuth token has specific scopes that determine what it can access:
- `repo` - Full control of private repositories
- `read:org` - Read organization membership
- `user` - Read user profile data
- `admin:org` - Manage organizations
- etc.

### 2. Accessible Organizations
The user may have access to:
- Personal account repositories
- Organization repositories (member/owner)
- Organizations they can create repos in

### 3. Token Metadata
- When the token was created
- Token expiration (if applicable)
- OAuth app name that created it

## Implementation Plan

### Step 1: Create GitHub API Service

Create a new service to fetch token information:

```typescript
// src/renderer/services/GitHubAPIService.ts
export class GitHubAPIService {
  private token: string;

  async getTokenScopes(): Promise<string[]> {
    // GitHub returns scopes in the X-OAuth-Scopes header
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const scopesHeader = response.headers.get('X-OAuth-Scopes');
    return scopesHeader ? scopesHeader.split(', ') : [];
  }

  async getUserOrganizations(): Promise<GitHubOrganization[]> {
    const response = await fetch('https://api.github.com/user/orgs', {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    return response.json();
  }

  async getAccessibleRepositories(org?: string): Promise<number> {
    // Get count of accessible repos (with pagination info)
    const url = org
      ? `https://api.github.com/orgs/${org}/repos?per_page=1`
      : 'https://api.github.com/user/repos?per_page=1';

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    // Parse Link header to get total count
    const linkHeader = response.headers.get('Link');
    // Parse last page number from Link header
    return this.parseRepoCount(linkHeader);
  }
}
```

### Step 2: Enhance AuthDetails Component

Add a new section to display token permissions:

```typescript
// In AuthDetails.tsx

const [tokenScopes, setTokenScopes] = useState<string[]>([]);
const [organizations, setOrganizations] = useState<GitHubOrganization[]>([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (isAuthenticated && authUser) {
    fetchTokenInfo();
  }
}, [isAuthenticated, authUser]);

const fetchTokenInfo = async () => {
  setLoading(true);
  try {
    const githubAPI = new GitHubAPIService(token);
    const [scopes, orgs] = await Promise.all([
      githubAPI.getTokenScopes(),
      githubAPI.getUserOrganizations()
    ]);

    setTokenScopes(scopes);
    setOrganizations(orgs);
  } catch (error) {
    console.error('Failed to fetch token info:', error);
  } finally {
    setLoading(false);
  }
};
```

### Step 3: UI Components

#### Token Scopes Display
```jsx
<div className="token-scopes">
  <h3>Token Permissions</h3>
  <div className="scope-badges">
    {tokenScopes.map(scope => (
      <span className="scope-badge" key={scope}>
        {formatScope(scope)}
      </span>
    ))}
  </div>
</div>
```

#### Organizations Access Display
```jsx
<div className="organizations-access">
  <h3>Organization Access</h3>
  <div className="org-list">
    {organizations.map(org => (
      <div className="org-item" key={org.login}>
        <img src={org.avatar_url} alt={org.login} />
        <div>
          <h4>{org.login}</h4>
          <span>{org.description}</span>
          <span className="repo-count">
            {org.public_repos} public repos
          </span>
        </div>
      </div>
    ))}
  </div>
</div>
```

### Step 4: Scope Descriptions

Create a mapping of scope to human-readable descriptions:

```typescript
const SCOPE_DESCRIPTIONS = {
  'repo': 'Full control of private repositories',
  'public_repo': 'Access public repositories',
  'repo:status': 'Access commit status',
  'repo_deployment': 'Access deployment status',
  'delete_repo': 'Delete repositories',
  'read:org': 'Read organization data',
  'write:org': 'Write organization data',
  'admin:org': 'Full organization control',
  'user': 'Update user profile',
  'read:user': 'Read user profile',
  'user:email': 'Access user email',
  'workflow': 'Update GitHub Actions workflows',
  // ... etc
};
```

## Security Considerations

1. **Token Storage**: Token should remain in secure storage, only fetch via IPC
2. **API Rate Limiting**: Cache API responses to avoid hitting GitHub rate limits
3. **Error Handling**: Gracefully handle API failures or invalid tokens
4. **Scope Changes**: Detect if token scopes have changed since last check

## Visual Design

```
┌─────────────────────────────────────────────────┐
│ Account & Authentication                        │
├─────────────────────────────────────────────────┤
│ ✓ Authenticated as @username                    │
│                                                 │
│ Token Permissions:                              │
│ [repo] [read:org] [user] [workflow]            │
│                                                 │
│ Organization Access:                            │
│ • personal (123 repos)                          │
│ • company-org (45 repos) [Admin]                │
│ • open-source-org (12 repos) [Member]           │
│                                                 │
│ Token Created: 2024-01-15                       │
│ Last Used: Today at 3:45 PM                     │
└─────────────────────────────────────────────────┘
```

## Benefits

1. **Transparency**: Users can see exactly what their token can access
2. **Security**: Users can verify their token has appropriate permissions
3. **Debugging**: Helps troubleshoot access issues
4. **Trust**: Shows the app is using standard GitHub OAuth properly

## Next Steps

1. Implement GitHubAPIService
2. Add token info fetching to AuthDetails
3. Design and implement UI components
4. Add caching to prevent API rate limit issues
5. Add refresh capability to update permissions
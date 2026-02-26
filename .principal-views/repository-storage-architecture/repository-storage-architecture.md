# Repository Storage Architecture

This document compares the two independent repository storage systems in Principal ADE.

## What Problem Does This Solve?

Principal ADE has evolved two separate systems for tracking repositories:

1. **REPOSITORIES Namespace**: Original electron-store based system
2. **Alexandria Registry**: Newer file-based system in home directory

Understanding these systems is crucial for maintenance and future consolidation.

## System Comparison

### REPOSITORIES Namespace (electron-store)

**Primary Key**: Remote URL (hashed)

**Stores**:
- Remote URL
- VCS type (github/gitlab/etc)
- Multiple local clones
- Custom avatars
- User tags
- Access timestamps
- GitHub metadata cache

**Used By**:
- EventServerManager (for repository lookup)
- RepositoryAvatar component
- RepositoryService (renderer)

### Alexandria Registry (~/.alexandria)

**Primary Key**: Local filesystem path

**Stores**:
- Local path
- Repository name
- Remote URL
- Workspace memberships
- CodebaseView configurations
- .alexandria/ directory contents
- GitHub metadata (fetched on demand)

**Used By**:
- PanelContext
- WorkspacesPanelContext
- AlexandriaService

## Key Difference: No Synchronization

These systems do not sync with each other. A repository can exist in one system but not the other, leading to:
- Inconsistent UI states
- Duplicate metadata storage
- Confusion about source of truth

## Decision Options

1. **Keep Both**: Maintain separate systems, consolidate later
2. **Migrate to Alexandria**: Move REPOSITORIES features into Alexandria
3. **Simplify**: Replace with in-memory cache, reduce persistence

## Recommendation

Consider migrating to Alexandria as the single source of truth:
- User-accessible storage location
- Better structured for workspace organization
- Cross-application compatibility

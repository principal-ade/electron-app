# Authentication and Palace Rooms Current State Documentation

## Overview

This document describes the current implementation state of authentication and Palace Room (workspace) functionality in the electron-app.

**Latest Updates (January 2025):**

* Authentication UI has been migrated to the interactive shell sidebar
* Login button removed from repository manager titlebar
* User avatar displayed in sidebar when authenticated
* IPC events refactored to use enums for type safety

## Authentication System

### Current Architecture

#### Main Process Components

1. **AuthService** (`src/main/services/AuthService.ts`)
   * Core authentication service handling OAuth flow
   * Uses UnifiedSecureStorage for credential encryption
   * Integrates with OAuthServerClient for WorkOS authentication
   * Manages IPC handlers for auth operations
   * Authentication flow through WorkOS (via principle-md.com server)
2. **AuthStateManager** (`src/main/services/AuthStateManager.ts`)
   * Singleton managing global auth state
   * Broadcasts auth state changes to all windows
   * Maintains current user and token information
3. **UnifiedSecureStorage** (`src/main/services/UnifiedSecureStorage.ts`)
   * Secure token storage using Electron's safeStorage
   * Manages OAuth tokens (GitHub access tokens via WorkOS) and other credentials
   * Handles migration from localStorage

#### Renderer Process Components

1. **useAuthState Hook** (`src/renderer/hooks/useAuthState.ts`)
   * React hook for auth state subscription
   * Handles login/logout operations
   * Manages local UI state (loading, errors)
   * Auto-syncs with main process auth changes
2. **SecureAuthService** (`src/renderer/services/SecureAuthService.ts`)
   * Legacy service layer for auth operations
   * Handles localStorage migration
   * Maps between different user formats
3. **AuthenticationService** (`src/renderer/main-process-api/AuthenticationService.ts`)
   * Renderer-side API wrapper for auth IPC calls
   * Provides typed interface to main process auth
4. **AuthView Component** (`src/renderer/principal-window/views/AuthView/AuthView.tsx`)
   * Main authentication UI in interactive shell sidebar
   * Shows login form when unauthenticated
   * Displays user profile and connected services when authenticated
   * Handles login/logout operations
5. **NavigationSidebar Component** (`src/renderer/principal-window/components/IntegratedShell/NavigationSidebar.tsx`)
   * Shows user avatar when authenticated
   * Falls back to User icon when not logged in
   * Provides access to AuthView via sidebar navigation

### Authentication Flow

1. **Login Process**:
   * User clicks auth icon in NavigationSidebar
   * AuthView component opens with login interface
   * User clicks "Sign In with GitHub" button
   * useAuthState hook calls AuthenticationService.login()
   * Main process initiates OAuth flow with WorkOS
   * Browser opens for user authorization via WorkOS (GitHub provider)
   * GitHub access token received from WorkOS and stored in UnifiedSecureStorage
   * AuthStateManager broadcasts state change
   * All windows update via useAuthState hook
   * User avatar appears in sidebar
2. **State Persistence**:
   * Tokens encrypted via Electron's safeStorage
   * User metadata stored alongside tokens
   * Auto-restore on app launch (lazy to avoid keychain prompts)
3. **Logout Process**:
   * User clicks auth icon to open AuthView
   * User clicks "Sign Out" button
   * Clears tokens from UnifiedSecureStorage
   * AuthStateManager broadcasts logout
   * Disconnects git-sync connections
   * Avatar reverts to User icon in sidebar

## Palace Rooms (Workspaces) System

### Current Architecture

#### Main Process Components

1. **PalaceRoomApiEventHandler** (`src/main/stores/PalaceRoomApiEventHandler.ts`)
   * Manages MemoryPalace instances per repository
   * Handles all Palace Room CRUD operations
   * Manages portals between rooms/repositories
   * Broadcasts room events to all windows
   * Integrates with AlexandriaRegistryService

#### Renderer Process Components

1. **PalaceRoomService** (`src/renderer/main-process-api/PalaceRoomService.ts`)
   * Renderer-side API wrapper for Palace Room IPC
   * Provides typed interface for room operations
2. **WorkspacesManager** (`src/renderer/principal-window/views/WorkspacesManager/WorkspacesManager.tsx`)
   * Main UI component for workspace management
   * Uses AnimatedResizableLayout from @a24z/panels
   * Lists all non-default Palace Rooms as workspaces
   * Manages workspace selection and details
3. **Related Components**:
   * WorkspaceListItem - Individual workspace in list
   * WorkspaceDetailsPanel - Shows workspace details/portals
   * CreateWorkspaceModal - UI for creating new workspaces

### Palace Room Features

1. **Room Management**:
   * Create/Update/Delete Palace Rooms
   * Each room has ID, name, description, timestamps
   * Default room per repository (hidden from workspace UI)
   * Rooms stored in `.alexandria/palace-rooms/` directory
2. **Portal System**:
   * Links between Palace Rooms across repositories
   * Portal types: local, remote
   * Sync strategies: on-demand, auto-sync
   * Reference types: full, partial
3. **Data Structure**:
   ```typescript
   interface PalaceRoom {
     id: string;
     name: string;
     description?: string;
     isDefault: boolean;
     createdAt: number;
     updatedAt: number;
     portals?: PalacePortal[];
   }
   ```

## Current Integration Points

### Where Authentication is Used

1. **Interactive Shell Sidebar**:
   * NavigationSidebar - Shows auth status via avatar/icon
   * AuthView - Main authentication UI component
   * Accessible from principal window
2. **Git Operations**:
   * GitSyncConnectionManager uses GitHub access token (obtained via WorkOS)
   * Remote file viewing requires authentication
   * Issues/PR fetching needs GitHub token
3. **Services Requiring Auth**:
   * Git sync operations
   * GitHub API calls
   * Remote repository access

### Where Palace Rooms are Used

1. **Principal Window**:
   * WorkspacesManager view (main UI)
   * Integrated with navigation sidebar
2. **Repository Context**:
   * Each repository can have multiple Palace Rooms
   * Rooms provide workspace isolation
   * Portals enable cross-repository navigation

## Migration Status

### Authentication Migration to Interactive Shell Sidebar ✅ COMPLETED

**Previous Location**: Titlebar (all windows)
**Current Location**: Interactive Shell Sidebar

**Completed Changes**:

1. ✅ Created AuthView component for sidebar
2. ✅ Integrated auth into NavigationSidebar with avatar display
3. ✅ Removed TitlebarAuth from RepositoryTitlebar
4. ✅ Maintained useAuthState hook for state management
5. ✅ Main process AuthService remains unchanged
6. ✅ Refactored IPC events to use enums for type safety
7. ✅ Auth state remains globally accessible from all windows

### Palace Rooms Migration to Workspaces

**Current Integration**: Part of RepoManager, tied to repositories
**Target Integration**: Standalone workspace system

**Key Challenges**:

1. Palace Rooms currently tied to repository paths
2. Workspace concept needs to be repository-independent
3. Portal system assumes repository context
4. Need to maintain backward compatibility

**Required Changes**:

1. Abstract workspace concept from Palace Rooms
2. Create workspace-first navigation model
3. Update portal system for workspace context
4. Migrate UI from repository-centric to workspace-centric

## Dependencies and APIs

### IPC Events

**Authentication** (using `AuthEvent` enum from `src/shared/ipc-events/AuthEvents.ts`):

* `AuthEvent.CHECK` - Check auth status
* `AuthEvent.STATUS` - Get current auth state
* `AuthEvent.LOGIN` - Initiate login flow
* `AuthEvent.LOGOUT` - Clear authentication
* `AuthEvent.STATE_GET` - Get current auth state
* `AuthEvent.STATE_SUBSCRIBE` - Subscribe to auth changes
* `AuthEvent.STATE_CHANGED` - Broadcast auth changes
* `AuthEvent.STATE_UNSUBSCRIBE` - Unsubscribe from auth changes

**Token Management** (using `SecureTokenAPIEvent` enum from `src/shared/main-process-api-interfaces/SecureTokenAPI.ts`):

* Various token operations for secure storage

**Palace Rooms**:

* `palace-room:list-all` - List all rooms
* `palace-room:list` - List rooms for repository
* `palace-room:create` - Create new room
* `palace-room:update` - Update room
* `palace-room:delete` - Delete room
* `palace-room:add-portal` - Add portal
* `palace-room:remove-portal` - Remove portal

### External Dependencies

* `@a24z/core-library` - Palace Room/Portal types
* `@a24z/panels` - UI layout components
* `electron-store` - Persistent storage
* WorkOS - Authentication provider (using GitHub as identity provider)

## Recommendations for Remaining Work

### Palace Rooms to Workspaces Migration

1. **Phase 1: Workspace Abstraction**
   * Create workspace service layer
   * Map workspaces to Palace Rooms
   * Update UI to workspace model
   * Maintain backward compatibility
2. **Phase 2: Full Migration**
   * Complete workspace UI migration
   * Update all references
   * Clean up old Palace Room code

### Potential Improvements

1. **Authentication Enhancements**
   * Add support for multiple auth providers
   * Implement refresh token mechanism
   * Add session timeout handling
   * Consider biometric authentication for token access
2. **UI/UX Improvements**
   * Add loading states during OAuth flow
   * Improve error messaging and recovery
   * Add auth status indicators in other views
   * Consider adding quick logout from sidebar hover

## File Structure Summary

### Authentication Files

```markdown
Main Process:
- src/main/services/AuthService.ts
- src/main/services/AuthStateManager.ts
- src/main/services/UnifiedSecureStorage.ts
- src/main/services/OAuthServerClient.ts
- src/main/services/SecureTokenIPC.ts

Renderer Process:
- src/renderer/hooks/useAuthState.ts
- src/renderer/services/SecureAuthService.ts
- src/renderer/main-process-api/AuthenticationService.ts
- src/renderer/principal-window/views/AuthView/AuthView.tsx
- src/renderer/principal-window/components/IntegratedShell/NavigationSidebar.tsx

Shared:
- src/shared/main-process-api-interfaces/AuthenticationAPI.ts
- src/shared/main-process-api-interfaces/SecureTokenAPI.ts
- src/shared/ipc-events/AuthEvents.ts

Preload/Window:
- src/window/main-process-api-implementations/authenticationApi.ts
```

### Palace Room Files

```markdown
Main Process:
- src/main/stores/PalaceRoomApiEventHandler.ts
- src/main/stores/AlexandriaRegistryService.ts

Renderer Process:
- src/renderer/main-process-api/PalaceRoomService.ts
- src/renderer/principal-window/views/WorkspacesManager/*

Shared:
- src/shared/main-process-api-interfaces/PalaceRoomAPI.ts
```

This document provides the current state snapshot needed for planning the migration of authentication and Palace Rooms to their new locations.
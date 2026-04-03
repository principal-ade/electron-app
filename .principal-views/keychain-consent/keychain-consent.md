# Keychain Consent Flow

## Overview

This canvas documents the first-run keychain consent experience for macOS Keychain access. The flow ensures users understand why the app needs keychain access before the system permission prompt appears.

## Problem Solved

Previously, the app would trigger the macOS Keychain permission prompt immediately on startup with no prior context. This confused users who didn't understand why the app needed access to their keychain.

## Solution

A consent flow that:
1. Checks consent status before accessing keychain
2. Shows an explanatory modal on first run
3. Only triggers keychain access after user grants consent
4. Allows users to skip and enable later via Settings

## Flow Stages

### 1. App Startup (Main Process)

| Event | Description |
|-------|-------------|
| `keychain_consent.startup.check` | Checks consent status from user preferences |
| `keychain_consent.auth_init.skipped` | Auth init skipped if consent not granted |
| `keychain_consent.auth_init.proceed` | Auth init proceeds if consent granted |

**File:** `src/main/main.ts`

### 2. Renderer Initialization

| Event | Description |
|-------|-------------|
| `keychain_consent.renderer.load` | Renderer loads consent status via IPC |
| `keychain_consent.modal.shown` | Consent modal displayed to user |

**Files:**
- `src/renderer/hooks/useKeychainConsent.ts`
- `src/renderer/components/KeychainConsentModal.tsx`

### 3. User Decision

| Event | Description |
|-------|-------------|
| `keychain_consent.user.granted` | User clicked "Allow" |
| `keychain_consent.user.declined` | User clicked "Skip for now" |
| `keychain_consent.persisted` | Decision saved to preferences |

**File:** `src/renderer/hooks/useKeychainConsent.ts`

### 4. Keychain Initialization (if granted)

| Event | Description |
|-------|-------------|
| `keychain_consent.init.requested` | Request to initialize keychain auth |
| `keychain_consent.keychain.access` | macOS system prompt triggered |
| `keychain_consent.init.success` | Keychain initialized successfully |
| `keychain_consent.init.error` | Keychain initialization failed |

**Files:**
- `src/main/services/AuthService.ts`
- `src/main/services/UnifiedSecureStorage.ts`

### 5. Settings Re-enable Flow

| Event | Description |
|-------|-------------|
| `keychain_consent.settings.enable_requested` | User requests enable from Settings |
| `keychain_consent.auth_view.blocked` | Auth view shows consent required |

**Files:**
- `src/renderer/principal-window/views/Settings/components/SecuritySettings.tsx`
- `src/renderer/principal-window/views/AuthView/AuthView.tsx`

## Key Attributes

### Consent Status
- `pending` - User has not yet decided
- `granted` - User allowed keychain access
- `declined` - User skipped/declined keychain access

### Error Types
- `timeout` - Keychain operation timed out
- `permission_denied` - User denied system keychain prompt
- `not_available` - Keychain not available on system
- `unknown` - Other error

## IPC Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `GET_KEYCHAIN_CONSENT` | Renderer → Main | Get current consent status |
| `SET_KEYCHAIN_CONSENT` | Renderer → Main | Save consent decision |
| `INITIALIZE_KEYCHAIN_AUTH` | Renderer → Main | Trigger keychain initialization |

## Design Decisions

### Why gate at startup?

The keychain access was triggering during `authService.initializeAuthState()` in `main.ts`. By checking consent status before this call, we prevent the system prompt from appearing without context.

### Why not show modal in splash screen?

The splash screen renders before the main window's React tree is mounted. The consent modal needs access to the theme context and IPC communication, which requires the full renderer to be ready.

### Why persist to user preferences?

User preferences use `electron-store` which doesn't require keychain access. This allows us to track consent status without triggering the very permission we're asking about.

### Why allow re-enable via Settings?

Users who initially decline should have a way to enable secure storage later without reinstalling the app. The Settings → Security page provides this path.

## Related Files

- `src/shared/types/userPreferences.types.ts` - KeychainConsentState type
- `src/shared/ipc-events/AuthEvents.ts` - IPC event definitions
- `src/main/main.ts` - Startup consent check
- `src/main/services/AuthService.ts` - Consent IPC handlers
- `src/renderer/hooks/useKeychainConsent.ts` - React hook for consent state
- `src/renderer/components/KeychainConsentModal.tsx` - Consent modal UI
- `src/renderer/principal-window/views/Settings/components/SecuritySettings.tsx` - Settings UI

## Related Documentation

- `docs/keychain-consent-feature-audit.md` - Comprehensive audit of features affected by keychain consent

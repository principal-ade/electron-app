# On-Demand Secret Fetching Implementation Proposal

## Current Security Concern

### Problem
The current `SecretsModal` implementation fetches ALL secrets immediately when the modal opens:

```typescript
// Current implementation - SecretsModal.tsx
useEffect(() => {
  if (isOpen) {
    loadSecrets(); // Fetches ALL secret values immediately
  }
}, [isOpen]);

const loadSecrets = async () => {
  const storedSecrets = await SecretsService.get(repoId); // Returns ALL key-value pairs
  setSecrets(storedSecrets); // Stores all values in component state
};
```

**Security Issues:**
1. **Memory Exposure**: All secret values are held in JavaScript memory in the renderer process, even when masked on screen
2. **Broader Attack Surface**: If the renderer process is compromised, all secrets are immediately accessible
3. **Unnecessary Exposure**: Users might only need to view/edit one secret, but all are loaded
4. **Memory Persistence**: Secret values remain in memory until the modal is closed or component unmounts

## Proposed Solution: On-Demand Fetching

### Architecture Overview

The solution provides three different interaction modes for secrets, each with different security characteristics:

#### Mode 1: Copy to Clipboard (Most Secure)
```
User clicks "Copy" button
    ↓
Main process fetches secret from secure storage
    ↓
Main process writes directly to system clipboard
    ↓
Success indicator shown (no value in renderer)
```
**Security**: Secret value NEVER enters renderer process memory

#### Mode 2: View Secret (On-Demand)
```
User clicks "Eye" icon
    ↓
Renderer requests specific secret from main process
    ↓
Secret loaded into renderer memory
    ↓
Value displayed in UI
    ↓
Auto-hide after 30 seconds
    ↓
Clear from memory
```
**Security**: Secret only in memory when explicitly requested and for limited time

#### Mode 3: Edit Secret (Required Loading)
```
User clicks "Edit" button
    ↓
Fetch secret if not already loaded
    ↓
Enter edit mode with value in input field
    ↓
Save changes or cancel
    ↓
Clear from memory after save
```
**Security**: Value must be in memory for editing, cleared after operation

### Implementation Plan

## Phase 1: Update API Contracts

### 1.1 New API Methods in SecretsAPI

```typescript
// shared/main-process-api-interfaces/SecretsAPI.ts

export interface SecretMetadataOnly {
  keys: string[];
  count: number;
  updatedAt: number;
  repoId: string;
}

export interface CopyResult {
  success: boolean;
  error?: string;
}

export interface SecretsEvents {
  // Existing
  GET: 'secrets:get';
  STORE: 'secrets:store';

  // New methods
  GET_METADATA: 'secrets:get-metadata';      // Get only keys, no values
  GET_SINGLE: 'secrets:get-single';          // Get a single secret value
  GET_MULTIPLE: 'secrets:get-multiple';      // Get specific secret values
  COPY_TO_CLIPBOARD: 'secrets:copy-to-clipboard'; // Copy directly to clipboard without returning value
}
```

### 1.2 Update SecretsService (Renderer)

```typescript
// src/renderer/main-process-api/SecretsService.ts

export class SecretsService {
  /**
   * Get only metadata and keys for a repository (no values)
   */
  static async getMetadata(repoId: string): Promise<SecretMetadataOnly | null> {
    return window.mainProcess.secrets.getMetadata(repoId);
  }

  /**
   * Get a single secret value on demand
   */
  static async getSingle(repoId: string, key: string): Promise<string | null> {
    return window.mainProcess.secrets.getSingle(repoId, key);
  }

  /**
   * Get multiple specific secret values
   */
  static async getMultiple(repoId: string, keys: string[]): Promise<Record<string, string>> {
    return window.mainProcess.secrets.getMultiple(repoId, keys);
  }

  /**
   * Copy a secret directly to clipboard without exposing it to renderer
   * The value never enters the renderer process memory
   */
  static async copyToClipboard(repoId: string, key: string): Promise<CopyResult> {
    return window.mainProcess.secrets.copyToClipboard(repoId, key);
  }
}
```

## Phase 2: Update Main Process Handlers

### 2.1 Update secretHandlers.ts

```typescript
// src/main/stores/secretHandlers.ts

// Get only metadata without values
ipcMain.handle(
  SecretsEvents.GET_METADATA,
  async (
    event: IpcMainInvokeEvent,
    repoId: string
  ): Promise<SecretMetadataOnly | null> => {
    try {
      if (!validateSource(event)) {
        throw new Error('Unauthorized source');
      }

      const storage = getStorage();
      const secrets = await storage.getSecrets(repoId);

      if (!secrets) {
        return null;
      }

      // Return only metadata, not values
      return {
        keys: Object.keys(secrets),
        count: Object.keys(secrets).length,
        updatedAt: Date.now(),
        repoId
      };
    } catch (error) {
      console.error('[SecretHandlers] Error getting metadata:', error);
      return null;
    }
  }
);

// Get a single secret value
ipcMain.handle(
  SecretsEvents.GET_SINGLE,
  async (
    event: IpcMainInvokeEvent,
    repoId: string,
    key: string
  ): Promise<string | null> => {
    try {
      if (!validateSource(event)) {
        throw new Error('Unauthorized source');
      }

      const storage = getStorage();
      const secrets = await storage.getSecrets(repoId);

      if (!secrets || !secrets[key]) {
        return null;
      }

      // Log access for audit
      console.log(`[SecretHandlers] Secret accessed: ${repoId}/${key}`);

      return secrets[key];
    } catch (error) {
      console.error('[SecretHandlers] Error getting single secret:', error);
      return null;
    }
  }
);

// Copy secret directly to clipboard without exposing to renderer
ipcMain.handle(
  SecretsEvents.COPY_TO_CLIPBOARD,
  async (
    event: IpcMainInvokeEvent,
    repoId: string,
    key: string
  ): Promise<CopyResult> => {
    try {
      if (!validateSource(event)) {
        return { success: false, error: 'Unauthorized source' };
      }

      const storage = getStorage();
      const secrets = await storage.getSecrets(repoId);

      if (!secrets || !secrets[key]) {
        return { success: false, error: 'Secret not found' };
      }

      // Use Electron's clipboard API in main process
      const { clipboard } = require('electron');

      // Copy to clipboard
      clipboard.writeText(secrets[key]);

      // Log access for audit
      console.log(`[SecretHandlers] Secret copied to clipboard: ${repoId}/${key}`);

      return { success: true };
    } catch (error: any) {
      console.error('[SecretHandlers] Error copying to clipboard:', error);
      return { success: false, error: error.message };
    }
  }
);
```

## Phase 3: Update SecretsModal Component

### 3.1 New State Management

```typescript
// src/renderer/pages/RepoManager/shared/SecretsModal.tsx

interface SecretValue {
  value: string;
  fetchedAt: number;
  autoHideTimeout?: NodeJS.Timeout;
}

export const SecretsModal: React.FC<SecretsModalProps> = ({ ... }) => {
  // Instead of storing all secrets
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [loadedSecrets, setLoadedSecrets] = useState<Record<string, SecretValue>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  // Auto-hide timeout (30 seconds)
  const AUTO_HIDE_TIMEOUT = 30000;
```

### 3.2 Load Only Metadata Initially

```typescript
const loadSecretMetadata = async () => {
  setLoading(true);
  setError(null);
  try {
    const repoId = getRepoId();
    const metadata = await SecretsService.getMetadata(repoId);

    if (metadata) {
      setSecretKeys(metadata.keys);
      setMetadata({
        updatedAt: metadata.updatedAt,
        secretCount: metadata.count,
        repoId: metadata.repoId
      });
    } else {
      setSecretKeys([]);
      setMetadata(null);
    }
  } catch (err) {
    console.error('Failed to load secret metadata:', err);
    setError('Failed to load secrets');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  if (isOpen) {
    loadSecretMetadata(); // Only load metadata, not values
  } else {
    // Clear all loaded secrets when modal closes
    clearAllLoadedSecrets();
  }
}, [isOpen]);
```

### 3.3 Fetch Individual Secrets On Demand

```typescript
const fetchSecretValue = async (key: string) => {
  // Don't refetch if already loaded and recent
  if (loadedSecrets[key] && Date.now() - loadedSecrets[key].fetchedAt < 5000) {
    return;
  }

  setLoadingKeys(prev => new Set(prev).add(key));

  try {
    const repoId = getRepoId();
    const value = await SecretsService.getSingle(repoId, key);

    if (value !== null) {
      // Clear existing timeout if any
      if (loadedSecrets[key]?.autoHideTimeout) {
        clearTimeout(loadedSecrets[key].autoHideTimeout);
      }

      // Set auto-hide timeout
      const timeout = setTimeout(() => {
        hideSecretValue(key);
      }, AUTO_HIDE_TIMEOUT);

      setLoadedSecrets(prev => ({
        ...prev,
        [key]: {
          value,
          fetchedAt: Date.now(),
          autoHideTimeout: timeout
        }
      }));
    }
  } catch (err) {
    console.error(`Failed to fetch secret ${key}:`, err);
    setError(`Failed to load secret: ${key}`);
  } finally {
    setLoadingKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
  }
};

const toggleShowValue = async (key: string) => {
  const isShowing = showValues[key];

  if (!isShowing) {
    // Fetch the value if not already loaded
    if (!loadedSecrets[key]) {
      await fetchSecretValue(key);
    }
    setShowValues({ ...showValues, [key]: true });
  } else {
    // Hide and optionally clear from memory
    setShowValues({ ...showValues, [key]: false });
    // Optional: Clear from memory immediately
    // clearSecretFromMemory(key);
  }
};

const hideSecretValue = (key: string) => {
  setShowValues(prev => ({ ...prev, [key]: false }));
  // Clear from memory after hiding
  clearSecretFromMemory(key);
};

const clearSecretFromMemory = (key: string) => {
  setLoadedSecrets(prev => {
    const newSecrets = { ...prev };
    if (newSecrets[key]?.autoHideTimeout) {
      clearTimeout(newSecrets[key].autoHideTimeout);
    }
    delete newSecrets[key];
    return newSecrets;
  });
};

const clearAllLoadedSecrets = () => {
  // Clear all timeouts
  Object.values(loadedSecrets).forEach(secret => {
    if (secret.autoHideTimeout) {
      clearTimeout(secret.autoHideTimeout);
    }
  });
  setLoadedSecrets({});
  setShowValues({});
};
```

### 3.4 Update UI Rendering

```typescript
import { Copy, Check } from 'lucide-react';

// Add state for tracking copy success
const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());

// Copy to clipboard handler - doesn't load value into renderer
const copyToClipboard = async (key: string) => {
  try {
    const repoId = getRepoId();
    const result = await SecretsService.copyToClipboard(repoId, key);

    if (result.success) {
      // Show success feedback
      setCopiedKeys(prev => new Set(prev).add(key));

      // Clear success indicator after 2 seconds
      setTimeout(() => {
        setCopiedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }, 2000);
    } else {
      setError(result.error || 'Failed to copy to clipboard');
    }
  } catch (err) {
    console.error('Failed to copy secret:', err);
    setError('Failed to copy secret');
  }
};

// UI Rendering
{secretKeys.map((key) => {
  const isLoading = loadingKeys.has(key);
  const secretValue = loadedSecrets[key]?.value;
  const isShowing = showValues[key];
  const isCopied = copiedKeys.has(key);

  return (
    <div key={key} style={{ /* ... */ }}>
      <Key size={14} />
      <span>{key}</span>

      <div style={{ flex: 1 }}>
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isShowing && secretValue ? (
          secretValue
        ) : (
          '••••••••'
        )}
      </div>

      {/* Copy button - direct to clipboard without loading in renderer */}
      <button
        onClick={() => copyToClipboard(key)}
        style={{
          padding: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isCopied ? theme.colors.success : theme.colors.textSecondary,
          display: 'flex',
          alignItems: 'center',
        }}
        title={isCopied ? 'Copied!' : 'Copy to clipboard'}
      >
        {isCopied ? <Check size={14} /> : <Copy size={14} />}
      </button>

      {/* View/Hide button - loads value into renderer */}
      <button
        onClick={() => toggleShowValue(key)}
        disabled={isLoading}
        style={{
          padding: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: theme.colors.textSecondary,
          display: 'flex',
          alignItems: 'center',
        }}
        title={isShowing ? 'Hide value' : 'Show value'}
      >
        {isShowing ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>

      {/* Edit button - needs to fetch first */}
      <button
        onClick={async () => {
          if (!secretValue) {
            await fetchSecretValue(key);
          }
          setEditingKey(key);
          setEditingValue(loadedSecrets[key]?.value || '');
        }}
        style={{
          padding: '4px 8px',
          backgroundColor: 'transparent',
          color: theme.colors.primary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        Edit
      </button>

      {/* Delete button */}
      <button
        onClick={() => {
          if (confirm(`Delete secret "${key}"?`)) {
            deleteSecret(key);
          }
        }}
        style={{
          padding: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: theme.colors.error || '#ef4444',
          display: 'flex',
          alignItems: 'center',
        }}
        title="Delete secret"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
})}
```

### 3.5 Handle Batch Operations

For operations that need multiple secrets (like saving all):

```typescript
const saveSecrets = async () => {
  setSaving(true);
  setError(null);

  try {
    // For save, we need to fetch all current values that aren't loaded
    const keysToFetch = secretKeys.filter(key => !loadedSecrets[key]);

    if (keysToFetch.length > 0) {
      // Batch fetch unloaded secrets
      const values = await SecretsService.getMultiple(getRepoId(), keysToFetch);

      // Merge with already loaded secrets
      const allSecrets = {
        ...values,
        ...Object.fromEntries(
          Object.entries(loadedSecrets).map(([k, v]) => [k, v.value])
        )
      };

      await SecretsService.store({
        repoId: getRepoId(),
        repoPath: getRepoPath(),
        secrets: allSecrets
      });
    } else {
      // All secrets are already loaded
      const allSecrets = Object.fromEntries(
        Object.entries(loadedSecrets).map(([k, v]) => [k, v.value])
      );

      await SecretsService.store({
        repoId: getRepoId(),
        repoPath: getRepoPath(),
        secrets: allSecrets
      });
    }

    setHasChanges(false);
  } catch (err) {
    setError('Failed to save secrets');
  } finally {
    setSaving(false);
  }
};
```

## Phase 4: Security Enhancements

### 4.1 Additional Security Measures

1. **Audit Logging**: Log every secret access with timestamp and key
2. **Rate Limiting**: Prevent rapid fetching of all secrets
3. **Memory Clearing**: Aggressive clearing of values from memory
4. **Session Timeout**: Auto-lock secrets modal after inactivity

### 4.2 Memory Security Utilities

```typescript
// src/renderer/utils/secureMemory.ts

/**
 * Attempt to clear sensitive data from memory
 * Note: JavaScript doesn't guarantee immediate memory clearing,
 * but this helps reduce the window of exposure
 */
export const clearSensitiveString = (value: string): void => {
  if (typeof value === 'string' && value.length > 0) {
    // Overwrite the string content if possible
    try {
      // This won't work for string literals but helps with string objects
      for (let i = 0; i < value.length; i++) {
        value[i] = '\0';
      }
    } catch {
      // String is immutable, can't overwrite
    }
  }
};

/**
 * Create a timeout-based auto-clear wrapper
 */
export class SecureValue {
  private _value: string | null;
  private timeout: NodeJS.Timeout | null = null;

  constructor(value: string, autoClearMs: number = 30000) {
    this._value = value;
    this.resetTimeout(autoClearMs);
  }

  get value(): string | null {
    return this._value;
  }

  private resetTimeout(ms: number) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      this.clear();
    }, ms);
  }

  clear() {
    if (this._value) {
      clearSensitiveString(this._value);
      this._value = null;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}
```

## Benefits of On-Demand Fetching

### Security Benefits
1. **Minimal Exposure**: Only requested secrets are in memory
2. **Time-Limited Access**: Automatic clearing after timeout
3. **Audit Trail**: Clear tracking of which secrets were accessed when
4. **Reduced Attack Surface**: Compromising renderer gets you keys, not values
5. **Direct Clipboard Copy**: Copy button transfers secrets directly from main process to clipboard without ever storing in renderer memory

### Performance Benefits
1. **Faster Initial Load**: Only metadata is fetched
2. **Reduced Memory Usage**: Only active secrets in memory
3. **Scalable**: Works well even with hundreds of secrets

### User Experience
1. **No Perceived Change**: UI behaves the same way
2. **Loading Indicators**: Clear feedback when fetching
3. **Auto-Hide**: Security-conscious auto-hiding of values
4. **Batch Operations**: Still supported when needed

## Migration Path

### Phase 1: Backend Implementation (2-3 hours)
- Add new IPC handlers for metadata and single secret fetching
- Maintain backward compatibility with existing `get` method
- Add audit logging

### Phase 2: Frontend Refactoring (3-4 hours)
- Update SecretsModal to use on-demand fetching
- Add loading states and auto-hide functionality
- Implement memory clearing utilities

### Phase 3: Testing (2 hours)
- Test all CRUD operations
- Verify auto-hide functionality
- Test batch operations (save all)
- Security testing (memory inspection)

### Phase 4: Rollout (1 hour)
- Deploy with feature flag if needed
- Monitor for performance issues
- Collect user feedback

## Alternative Approaches Considered

### 1. Encrypted Memory Storage
Store values encrypted in memory, decrypt only for display.
- **Pros**: Values always encrypted
- **Cons**: Key management complexity, performance overhead

### 2. Proxy Objects with Getters
Use JavaScript Proxy to intercept access and fetch on demand.
- **Pros**: Transparent to consuming code
- **Cons**: Complex debugging, potential performance issues

### 3. Service Worker Isolation
Run secret management in a service worker.
- **Pros**: Process isolation
- **Cons**: Not available in Electron renderer, complex IPC

## Conclusion

The on-demand fetching approach provides a significant security improvement with minimal user experience impact. It reduces the attack surface by keeping secrets out of memory until explicitly needed and automatically clearing them after use.

The implementation is straightforward and maintains backward compatibility while adding important security features like audit logging and auto-timeout.

## Next Steps

1. Review and approve the design
2. Implement Phase 1 (Backend changes)
3. Implement Phase 2 (Frontend changes)
4. Comprehensive security testing
5. Deploy with monitoring

## References

- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Node.js Secure Coding Practices](https://nodejs.org/en/docs/guides/security/)
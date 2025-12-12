# SSH Setup Implementation Guide

## Overview

This document outlines the implementation plan for the hybrid SSH setup feature that helps users configure SSH authentication when Git clone operations fail due to authentication issues.

### Problem Statement

Users who are new to GitHub may not have SSH keys configured, causing clone failures when:
- Trying to access private repositories
- Accessing organization repositories (OAuth tokens can't access org repos)
- HTTPS authentication fails or is insufficient

### Solution

Implement a **just-in-time SSH setup wizard** that:
1. Detects authentication failures during clone operations
2. Automatically generates SSH keys
3. Guides users through uploading the key to GitHub
4. Tests the connection
5. Automatically retries the clone with SSH

## Architecture

### Flow Diagram

```
User tries to clone repo
         ↓
    Clone fails
         ↓
  Is auth error? ──No──→ Show generic error
         ↓ Yes
  Show "Set Up SSH" button
         ↓
  User clicks button
         ↓
  SSH Setup Wizard opens
         ↓
  1. Generate SSH key
  2. Copy to clipboard
  3. Open GitHub in browser
  4. User pastes key
  5. Test connection
         ↓
  Success? ──No──→ Show error, allow retry
         ↓ Yes
  Retry clone with SSH URL
```

### Component Architecture

```
┌─────────────────────────────────────────────┐
│           GitCloneModal.tsx                 │
│  - Detects clone failures                   │
│  - Triggers SSH setup wizard                │
│  - Retries clone after setup                │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│        SSHSetupWizard.tsx (Renderer)        │
│  - UI for step-by-step setup                │
│  - Calls SSHSetupService                    │
└─────────────────┬───────────────────────────┘
                  │ IPC
                  ↓
┌─────────────────────────────────────────────┐
│    SSHSetupService.ts (Main Process)        │
│  - Generates SSH keys                       │
│  - Configures ~/.ssh/config                 │
│  - Adds key to ssh-agent                    │
│  - Tests GitHub connection                  │
└─────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Services (Main Process)

#### File: `src/main/services/git/SSHSetupService.ts`

**Purpose:** Handle all SSH key generation, configuration, and testing.

**Key Methods:**
- `generateSSHKey(): Promise<SSHKeyInfo>` - Generate ed25519 key
- `configureSSHConfig(keyPath): Promise<void>` - Update ~/.ssh/config
- `addKeyToAgent(keyPath): Promise<boolean>` - Add to ssh-agent
- `testGitHubConnection(): Promise<{success, message}>` - Test SSH connection
- `hasExistingSSHKey(): Promise<boolean>` - Check for existing keys

**Implementation Details:**
```typescript
interface SSHKeyInfo {
  privateKeyPath: string;    // ~/.ssh/principle_github
  publicKeyPath: string;     // ~/.ssh/principle_github.pub
  publicKey: string;         // The actual public key content
  fingerprint: string;       // Key fingerprint for verification
}
```

**Security Considerations:**
- Private key permissions: 0600
- Public key permissions: 0644
- SSH directory permissions: 0700
- SSH config permissions: 0600
- Use ed25519 algorithm (modern, secure)
- Generate keys with no passphrase (UX tradeoff)

**SSH Config Format:**
```
# Added by Principle AI
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/principle_github
    IdentitiesOnly yes
    AddKeysToAgent yes
```

#### File: `src/main/services/ipc/git/sshSetupHandlers.ts`

**Purpose:** IPC handlers for renderer to call SSH setup functions.

**Handlers:**
- `ssh-setup:generate-key` → generateSSHKey()
- `ssh-setup:configure-ssh` → configureSSHConfig()
- `ssh-setup:test-connection` → testGitHubConnection()
- `ssh-setup:has-existing-key` → hasExistingSSHKey()

**Registration:**
Add to `src/main/main.ts`:
```typescript
import { registerSSHSetupHandlers } from './services/ipc/git/sshSetupHandlers';

// In app.whenReady()
registerSSHSetupHandlers();
```

### Phase 2: Renderer API (Renderer Process)

#### File: `src/renderer/main-process-api/SSHSetupService.ts`

**Purpose:** Type-safe wrapper for calling main process SSH setup functions.

**API:**
```typescript
class SSHSetupService {
  static async generateKey(): Promise<SSHKeyInfo>
  static async configureSSH(privateKeyPath: string): Promise<{success: boolean}>
  static async testConnection(): Promise<{success: boolean; message: string}>
  static async hasExistingKey(): Promise<boolean>
}
```

### Phase 3: UI Components (Renderer Process)

#### File: `src/renderer/components/SSHSetupWizard.tsx`

**Purpose:** Step-by-step wizard for SSH setup.

**Steps:**
1. **Intro** - Explain what will happen
2. **Generating** - Show loading while key generates
3. **Upload** - Display key, copy button, open GitHub button
4. **Testing** - Show loading while testing connection
5. **Complete** - Success message, auto-close
6. **Error** - Show error, allow retry

**Props:**
```typescript
interface SSHSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;  // Called when setup completes successfully
  repositoryUrl?: string;  // Show which repo they're setting up for
}
```

**Key Features:**
- Auto-copy public key to clipboard
- Button to open GitHub SSH settings
- Connection testing with clear feedback
- Error handling with retry options
- Auto-retry clone on success

### Phase 4: Integration with GitCloneModal

#### File: `src/renderer/principal-window/views/RepositoryExplorer/components/GitCloneModal.tsx`

**Changes Required:**

1. **Add State Variables:**
```typescript
const [showSSHSetup, setShowSSHSetup] = useState(false);
const [cloneErrorType, setCloneErrorType] = useState<'auth' | 'network' | 'other'>('other');
```

2. **Enhanced Error Detection:**
```typescript
catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Failed to clone repository';
  const isAuthError =
    errorMessage.toLowerCase().includes('authentication') ||
    errorMessage.toLowerCase().includes('permission denied') ||
    errorMessage.toLowerCase().includes('403') ||
    errorMessage.toLowerCase().includes('could not read from remote');

  if (isAuthError) {
    setCloneErrorType('auth');
    setError('Authentication failed. Setting up SSH may help.');
  } else {
    setError(errorMessage);
  }
  setCurrentStep('error');
}
```

3. **Add "Set Up SSH" Button in Error Step:**
```tsx
{cloneErrorType === 'auth' && (
  <button onClick={() => setShowSSHSetup(true)}>
    <Key size={16} />
    Set Up SSH
  </button>
)}
```

4. **Add SSHSetupWizard Component:**
```tsx
<SSHSetupWizard
  isOpen={showSSHSetup}
  onClose={() => setShowSSHSetup(false)}
  onSuccess={handleRetryWithSSH}
  repositoryUrl={gitUrl}
/>
```

5. **Add Retry Function:**
```typescript
const handleRetryWithSSH = async () => {
  // Convert HTTPS URL to SSH format
  const normalizedUrl = normalizeGitUrl(gitUrl);
  let sshUrl = normalizedUrl;

  if (normalizedUrl.startsWith('https://')) {
    const match = normalizedUrl.match(/https:\/\/([^/]+)\/([^/]+)\/([^/.]+)\.git$/);
    if (match) {
      sshUrl = `git@${match[1]}:${match[2]}/${match[3]}.git`;
    }
  }

  setSelectedAuthMethod('ssh');
  setShowSSHSetup(false);

  if (cloneDirectory) {
    await handleStartClone(cloneDirectory);
  }
};
```

## Implementation Steps

### Step 1: Create Main Process Services

1. Create `src/main/services/git/SSHSetupService.ts`
2. Implement all methods with proper error handling
3. Test key generation manually via Node.js script

### Step 2: Create IPC Handlers

1. Create `src/main/services/ipc/git/sshSetupHandlers.ts`
2. Add all IPC handlers
3. Register handlers in `src/main/main.ts`
4. Test IPC communication via DevTools console

### Step 3: Create Renderer API

1. Create `src/renderer/main-process-api/SSHSetupService.ts`
2. Ensure TypeScript types match main process
3. Test API calls from renderer DevTools

### Step 4: Build UI Component

1. Create `src/renderer/components/SSHSetupWizard.tsx`
2. Implement all wizard steps
3. Test wizard flow in isolation
4. Add proper error handling

### Step 5: Integrate with Clone Modal

1. Modify `GitCloneModal.tsx`
2. Add error detection logic
3. Add "Set Up SSH" button
4. Add SSHSetupWizard component
5. Implement retry logic

### Step 6: Testing

1. Test with private repo (should trigger wizard)
2. Test with public repo (should work without SSH)
3. Test with org repo (should recommend SSH)
4. Test error scenarios (GitHub down, network issues)
5. Test retry flow after SSH setup

## Testing Plan

### Manual Testing Scenarios

#### Scenario 1: First-Time User, Private Repo
1. User has no SSH key configured
2. Try to clone private repo via HTTPS
3. Clone fails with 403
4. "Set Up SSH" button appears
5. Click button, wizard opens
6. Key generates successfully
7. User copies key and adds to GitHub
8. Connection test succeeds
9. Clone retries with SSH and succeeds

**Expected Result:** ✓ Clone succeeds, repo added to workspace

#### Scenario 2: Existing SSH Key
1. User already has GitHub SSH key
2. Try to clone private repo
3. Auth check detects working SSH
4. Clone uses SSH automatically
5. No wizard needed

**Expected Result:** ✓ Clone succeeds without showing wizard

#### Scenario 3: User Cancels Setup
1. Clone fails with auth error
2. User clicks "Set Up SSH"
3. Wizard opens
4. User clicks "Cancel"
5. Returns to error state

**Expected Result:** ✓ Can try again or close modal

#### Scenario 4: Network Error (Not Auth)
1. Clone fails due to network issue
2. Error shows but NO "Set Up SSH" button
3. Only "Try Again" button available

**Expected Result:** ✓ SSH setup not offered for non-auth errors

#### Scenario 5: Key Upload but Connection Fails
1. Wizard generates key
2. User claims to have uploaded key
3. Connection test fails
4. Error shown with retry option
5. User actually uploads key
6. Retry test succeeds

**Expected Result:** ✓ Can retry test without regenerating key

### Automated Testing

```typescript
// Test SSH key generation
describe('SSHSetupService', () => {
  it('should generate ed25519 SSH key', async () => {
    const keyInfo = await SSHSetupService.generateKey();
    expect(keyInfo.publicKey).toContain('ssh-ed25519');
    expect(fs.existsSync(keyInfo.privateKeyPath)).toBe(true);
  });

  it('should configure SSH config file', async () => {
    await SSHSetupService.configureSSH('/path/to/key');
    const config = fs.readFileSync('~/.ssh/config', 'utf-8');
    expect(config).toContain('Added by Principle AI');
  });
});
```

## Edge Cases & Considerations

### Edge Case 1: Multiple SSH Keys
**Scenario:** User has multiple SSH keys for different services.
**Solution:** Use `IdentitiesOnly yes` in SSH config to prevent trying all keys.

### Edge Case 2: SSH Agent Not Running
**Scenario:** ssh-agent not running on user's system.
**Solution:** Gracefully handle failure, SSH will still work without agent (may require manual passphrase entry if we add one later).

### Edge Case 3: Existing Principle Key
**Scenario:** User already ran setup wizard before.
**Solution:** Detect existing key, reuse it instead of generating new one.

### Edge Case 4: GitHub Down
**Scenario:** GitHub.com is unreachable when testing connection.
**Solution:** Show clear error: "Unable to reach GitHub. Please check your internet connection."

### Edge Case 5: Organization Repositories
**Scenario:** User needs to clone org repo but OAuth-uploaded keys don't work.
**Solution:** This is the PRIMARY use case - wizard handles it perfectly.

### Edge Case 6: Key Already in GitHub
**Scenario:** User already uploaded this key to GitHub before.
**Solution:** GitHub will reject duplicate key. Show error: "This key is already registered. If it was you, connection should work."

### Edge Case 7: Windows vs Mac Differences
**Scenario:** File paths and ssh-keygen behavior differ.
**Solution:**
- Use `os.homedir()` for cross-platform paths
- Use Node.js child_process for cross-platform commands
- Test on both platforms

## Security Considerations

### Private Key Security

**Current Approach:**
- Generate keys without passphrase for UX
- Store in `~/.ssh/` with 0600 permissions
- Add to ssh-agent (if available)

**Trade-offs:**
- ✓ Better UX (no passphrase prompts)
- ✗ Less secure if machine is compromised
- ✓ Standard for dev tools (VS Code, GitHub Desktop do this)

**Future Enhancement:**
Could add optional passphrase with secure storage in Electron's safeStorage.

### Key Scoping

**Recommendation:**
- Create ONE key for GitHub: `principle_github`
- Reuse this key for all GitHub operations
- Don't create per-repo keys (complexity vs security benefit)

### Key Rotation

**Not Implemented Initially:**
- Key rotation reminders
- Expiration dates
- Automatic cleanup of old keys

**Future Enhancement:**
Add settings panel to manage SSH keys.

## Future Enhancements

### Phase 2 Features

1. **SSH Key Management Panel**
   - View current keys
   - Test connections
   - Regenerate keys
   - Remove old keys from GitHub

2. **Multiple Git Providers**
   - Support GitLab
   - Support Bitbucket
   - Support GitHub Enterprise
   - Detect provider from URL

3. **Passphrase Protection**
   - Option to add passphrase
   - Store passphrase in Electron safeStorage
   - Unlock on app start

4. **Advanced SSH Config**
   - Configure custom SSH ports
   - Configure proxy settings
   - Configure multiple GitHub accounts

5. **GitHub CLI Integration**
   - Detect if `gh` is installed
   - Use `gh ssh-key add` for uploads
   - Use `gh auth setup-git` for config

## Success Metrics

### How to measure success:

1. **Reduction in clone failures** - Track clone success rate before/after
2. **Wizard completion rate** - % of users who complete setup
3. **Time to first successful clone** - Measure onboarding speed
4. **Support requests** - Reduction in "can't clone repo" issues

### Telemetry Points:

```typescript
// Track these events
analytics.track('ssh_setup_wizard_opened', { reason: 'clone_failure' });
analytics.track('ssh_setup_key_generated', { keyType: 'ed25519' });
analytics.track('ssh_setup_completed', { duration_seconds: 45 });
analytics.track('ssh_setup_failed', { error: 'connection_test_failed' });
analytics.track('clone_retry_after_ssh_setup', { success: true });
```

## Implementation Checklist

### Main Process
- [ ] Create `SSHSetupService.ts`
  - [ ] `generateSSHKey()` method
  - [ ] `configureSSHConfig()` method
  - [ ] `addKeyToAgent()` method
  - [ ] `testGitHubConnection()` method
  - [ ] `hasExistingSSHKey()` method
- [ ] Create `sshSetupHandlers.ts`
  - [ ] Register all IPC handlers
  - [ ] Add to main.ts initialization
- [ ] Test main process services

### Renderer Process
- [ ] Create `SSHSetupService.ts` (renderer API)
  - [ ] Type definitions
  - [ ] IPC wrapper methods
- [ ] Create `SSHSetupWizard.tsx`
  - [ ] Intro step
  - [ ] Generating step
  - [ ] Upload step (with copy & open GitHub)
  - [ ] Testing step
  - [ ] Complete step
  - [ ] Error step with retry
- [ ] Test wizard in isolation

### Integration
- [ ] Modify `GitCloneModal.tsx`
  - [ ] Add error detection logic
  - [ ] Add "Set Up SSH" button
  - [ ] Integrate SSHSetupWizard
  - [ ] Implement retry with SSH
- [ ] Test full flow end-to-end

### Testing
- [ ] Test with private repo
- [ ] Test with org repo
- [ ] Test with existing SSH key
- [ ] Test cancel flow
- [ ] Test network errors
- [ ] Test connection failures
- [ ] Test on macOS
- [ ] Test on Windows (if applicable)

### Documentation
- [ ] Add user-facing docs
- [ ] Add troubleshooting guide
- [ ] Update onboarding documentation
- [ ] Add developer notes

## Troubleshooting Guide (For Users)

### "Connection test failed"

**Possible Causes:**
1. Key not uploaded to GitHub yet
2. GitHub.com is unreachable
3. Firewall blocking SSH port 22

**Solutions:**
1. Verify key was pasted into GitHub SSH settings
2. Check internet connection
3. Try browser: https://github.com/settings/keys
4. Check SSH manually: `ssh -T git@github.com`

### "Permission denied (publickey)"

**Cause:** SSH key not recognized by GitHub

**Solution:**
1. Re-run setup wizard
2. Make sure key was copied completely
3. Check GitHub shows the key: https://github.com/settings/keys

### "Could not resolve host"

**Cause:** Network/DNS issue

**Solution:**
1. Check internet connection
2. Try: `ping github.com`
3. Try different network

## References

- [GitHub SSH Documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [SSH Key Best Practices](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
- [OAuth SSH Key Limitation](https://docs.github.com/en/rest/users/keys#create-a-public-ssh-key-for-the-authenticated-user) (Note: Keys added via API can't access org repos)
- Previous research: `docs/GITHUB_SSH_KEY_MANAGEMENT.md`

## Related Documents

- `docs/OAUTH_AND_PKCE_GUIDE.md` - Current OAuth implementation
- `docs/AUTHENTICATION_SERVICES.md` - Auth architecture
- `docs/GITHUB_SSH_KEY_MANAGEMENT.md` - API research

---

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 2-3 days
**Dependencies:** None (uses existing OAuth and Git infrastructure)

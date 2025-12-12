# ACT Integration Deployment & User Experience Options

## Current State

The ACT integration currently requires users to manually:
1. Install the `nektos/act` binary on their system
2. Have Docker installed and running
3. Pull the appropriate Docker images for workflow execution

This creates friction for new users and may result in confusing error messages if prerequisites aren't met.

## Goals

- Minimize setup steps for end users
- Provide clear, actionable error messages when prerequisites are missing
- Ensure cross-platform compatibility (macOS, Windows, Linux)
- Maintain security and performance

---

## Option 1: Bundle ACT Binary with Application

### Approach
Package the `act` binary directly with the Electron application for each platform.

### Pros
- ✅ Zero-config experience - users don't need to install act separately
- ✅ Guaranteed version compatibility - we control which version is used
- ✅ Works offline (after initial Docker image pull)
- ✅ Simpler onboarding - one less step for users

### Cons
- ❌ Increases application bundle size (~15-20MB per platform)
- ❌ Need to maintain binaries for multiple platforms (darwin-amd64, darwin-arm64, linux-amd64, linux-arm64, windows-amd64)
- ❌ Must update bundled binary when new act versions are released
- ❌ Still requires Docker to be installed separately
- ❌ Licensing considerations (act is Apache 2.0, compatible but requires attribution)

### Implementation
1. Download act binaries for each platform during build
2. Store in `app.asar.unpacked/bin/act` (or similar)
3. Update `ActRunnerService` to check for bundled binary first:
   ```typescript
   const bundledActPath = path.join(process.resourcesPath, 'bin', 'act');
   if (fs.existsSync(bundledActPath)) {
     return bundledActPath;
   }
   // Fall back to system PATH
   ```
4. Add to `package.json` build configuration to include binaries

### Estimated Effort
- **Development**: 2-3 days (download scripts, path resolution, testing)
- **Ongoing Maintenance**: Low (update binaries quarterly or when bugs found)

---

## Option 2: Guided Installation with Auto-Detection

### Approach
Detect missing prerequisites and guide users through installation with platform-specific instructions.

### Pros
- ✅ Smaller application size
- ✅ Users always have latest act version (if using package managers)
- ✅ Clear separation of concerns - we don't manage act binary lifecycle
- ✅ Easier to maintain (no binary bundling)

### Cons
- ❌ Requires user action during setup
- ❌ Different installation methods per platform (brew, chocolatey, manual)
- ❌ Users may have version compatibility issues if using old act versions
- ❌ More complex error handling and messaging

### Implementation

#### 1. Enhanced Detection UI
Create a "Setup Wizard" that checks prerequisites on first run or when validation fails:

```typescript
interface PrerequisiteStatus {
  docker: {
    installed: boolean;
    running: boolean;
    version?: string;
  };
  act: {
    installed: boolean;
    version?: string;
    upToDate: boolean;
  };
  images: {
    [key: string]: {
      pulled: boolean;
      platform: string;
    };
  };
}
```

#### 2. Platform-Specific Installation Instructions

**macOS:**
```bash
# Using Homebrew
brew install act

# Verify installation
act --version
```

**Linux:**
```bash
# Using curl
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Or using package manager (varies by distro)
```

**Windows:**
```powershell
# Using Chocolatey
choco install act-cli

# Or using Scoop
scoop install act
```

#### 3. Docker Image Management
Offer to pull required images when first running a workflow:

```typescript
async function ensureDockerImage(imageName: string): Promise<boolean> {
  // Check if image exists
  const imageExists = await checkDockerImage(imageName);

  if (!imageExists) {
    // Show progress dialog
    const userConsent = await showDialog({
      title: 'Download Required Docker Image',
      message: `The workflow requires the ${imageName} Docker image (~500MB). Download now?`,
      buttons: ['Download', 'Cancel']
    });

    if (userConsent) {
      await pullDockerImageWithProgress(imageName);
    }
  }

  return imageExists;
}
```

### Estimated Effort
- **Development**: 3-4 days (detection logic, UI components, platform-specific instructions)
- **Ongoing Maintenance**: Low (update instructions when installation methods change)

---

## Option 3: Hybrid Approach (Recommended)

### Approach
Combine the best of both options:
1. **Bundle act binary** as a fallback
2. **Prefer system-installed act** if available and up-to-date
3. **Guide users** through Docker setup with clear instructions

### Pros
- ✅ Works out-of-the-box for most users (bundled binary)
- ✅ Advanced users can use their own act installation
- ✅ Clear upgrade path and version management
- ✅ Best user experience with minimal friction

### Cons
- ❌ Most complex implementation
- ❌ Larger bundle size (but acceptable tradeoff)

### Implementation

#### 1. Binary Resolution Strategy
```typescript
async function resolveActBinary(): Promise<string> {
  // 1. Check for user-specified path in settings
  const userPath = getUserSettings().actBinaryPath;
  if (userPath && await isValidActBinary(userPath)) {
    return userPath;
  }

  // 2. Check system PATH for installed version
  const systemAct = await findInPath('act');
  if (systemAct && await isVersionCompatible(systemAct)) {
    return systemAct;
  }

  // 3. Fall back to bundled binary
  const bundledPath = getBundledActPath();
  if (await fs.pathExists(bundledPath)) {
    return bundledPath;
  }

  throw new Error('No compatible act binary found');
}
```

#### 2. Settings UI
Add preferences panel for ACT configuration:
```
┌─────────────────────────────────────────┐
│ GitHub Actions (ACT) Settings          │
├─────────────────────────────────────────┤
│                                         │
│ ACT Binary:                             │
│ ● Use bundled version (0.2.82)         │
│ ○ Use system installation               │
│   Path: /opt/homebrew/bin/act          │
│   Version: 0.2.85 ✓                     │
│ ○ Custom path                           │
│   [Browse...]                           │
│                                         │
│ Docker Image:                           │
│ Platform: ● Auto-detect ○ linux/amd64  │
│           ○ linux/arm64                 │
│                                         │
│ Image: catthehacker/ubuntu:act-latest  │
│ Status: Downloaded (arm64) ✓            │
│                                         │
│ [Test Configuration]                    │
└─────────────────────────────────────────┘
```

#### 3. Enhanced Error Messages
```typescript
const ERROR_MESSAGES = {
  NO_DOCKER: {
    title: 'Docker Not Running',
    message: 'GitHub Actions workflows require Docker to execute.\n\n' +
             'Please install Docker Desktop and start it, then try again.',
    actions: [
      { label: 'Download Docker', url: 'https://docker.com/get-started' },
      { label: 'Help', url: 'https://docs.yourapp.com/act-setup' }
    ]
  },
  IMAGE_NOT_FOUND: {
    title: 'Docker Image Required',
    message: 'This workflow needs a Docker image (~500MB).\n\n' +
             'Would you like to download it now?',
    actions: [
      { label: 'Download', action: 'pull-image' },
      { label: 'Cancel' }
    ]
  }
};
```

### Estimated Effort
- **Development**: 5-6 days (binary bundling + detection + settings UI)
- **Ongoing Maintenance**: Medium (update bundled binaries, maintain detection logic)

---

## Docker Considerations

### Current Requirement
ACT requires Docker to be installed and running. This is non-negotiable for the current implementation.

### Options for Docker Management

#### A. Require Manual Installation (Current)
- User installs Docker Desktop
- Application detects and validates
- **Pro**: Simple, no licensing issues
- **Con**: Adds setup friction

#### B. Docker Desktop Integration
- Detect Docker Desktop installation
- Offer to open Docker Desktop if not running
- Show Docker status in application
- **Pro**: Better UX, clear status
- **Con**: Still requires manual install

#### C. Alternative Runtimes (Future)
Investigate alternatives to Docker Desktop:
- **Podman**: Docker-compatible, no daemon required
- **Colima**: Lightweight container runtime for macOS
- **OrbStack**: Fast Docker alternative for macOS

**Consideration**: Would require testing act compatibility with each runtime.

### Recommended Approach
1. Detect Docker Desktop installation
2. Show clear status indicator in UI:
   ```
   Docker: ● Running (20.10.23)
          ⚠️ Not running - [Start Docker]
          ○ Not installed - [Install Docker]
   ```
3. Add "Check Docker" button in settings
4. Future: Support alternative runtimes if demand exists

---

## Image Management Strategy

### Current Issues
- Users must manually pull images
- Platform mismatches (amd64 vs arm64)
- Multiple images may be needed for different workflows

### Recommended Solution

#### 1. Automatic Image Detection
Parse workflow files to determine required images:
```typescript
function getRequiredImages(workflow: ParsedWorkflow): string[] {
  const images = new Set<string>();

  for (const job of Object.values(workflow.jobs)) {
    if (job['runs-on']) {
      const platform = job['runs-on'];
      const image = PLATFORM_TO_IMAGE[platform] || DEFAULT_IMAGE;
      images.add(image);
    }
  }

  return Array.from(images);
}
```

#### 2. Lazy Pull with Progress
Only pull images when needed, show progress:
```typescript
async function ensureImage(imageName: string, onProgress: (percent: number) => void) {
  const exists = await checkImageExists(imageName);

  if (!exists) {
    await showImagePullDialog(imageName, async () => {
      await pullImageWithProgress(imageName, onProgress);
    });
  }
}
```

#### 3. Image Cache Management
Show downloaded images in settings with disk usage:
```
Docker Images:
├─ catthehacker/ubuntu:act-latest (arm64) - 505 MB
├─ catthehacker/ubuntu:act-20.04 (arm64) - 612 MB
└─ [Clean Up Unused Images]
```

---

## Recommended Implementation Plan

### Phase 1: Enhanced Detection & Messaging (Week 1)
1. Improve prerequisite detection
2. Add clear error messages with installation links
3. Show Docker status in UI
4. Test configuration button

**Goal**: Users understand what's missing and how to fix it

### Phase 2: Bundle ACT Binary (Week 2)
1. Download act binaries for all platforms
2. Add to build process
3. Implement binary resolution strategy
4. Add settings panel for binary selection

**Goal**: Zero-config experience for act binary

### Phase 3: Image Management (Week 3)
1. Detect required images from workflows
2. Offer to pull missing images
3. Show pull progress
4. Add image cache management UI

**Goal**: Automatic image management with user consent

### Phase 4: Polish & Documentation (Week 4)
1. Create user documentation
2. Add in-app help and tooltips
3. Create setup wizard for first-time users
4. Add troubleshooting guide

**Goal**: Complete, polished user experience

---

## Security Considerations

### Binary Bundling
- Verify checksums of downloaded binaries
- Use official GitHub releases only
- Document verification process in CI/CD

### Docker Security
- Use official act Docker images
- Pin image versions to avoid supply chain attacks
- Allow users to specify custom images (advanced)

### Secrets Handling
- Never pass secrets via environment variables
- Always use `--secret-file` with mode 0600
- Clean up secret files immediately after execution
- Already implemented in Phase 4 ✅

---

## Cost-Benefit Analysis

| Approach | Setup Time | Bundle Size | Maintenance | UX Quality |
|----------|-----------|-------------|-------------|------------|
| Manual only | 10-15 min | 0 MB | Low | ★★☆☆☆ |
| Guided install | 5-10 min | 0 MB | Low | ★★★☆☆ |
| Bundle binary | 2-5 min | +20 MB | Medium | ★★★★☆ |
| Hybrid (recommended) | 0-5 min | +20 MB | Medium | ★★★★★ |

**Recommendation**: Implement **Hybrid Approach (Option 3)** for best user experience with acceptable tradeoffs.

---

## Open Questions

1. **Minimum Docker version**: What's the minimum Docker version we should support?
2. **Image size warnings**: Should we warn users about large image downloads on metered connections?
3. **Offline support**: How should the app behave when Docker images aren't available and network is offline?
4. **Platform support**: Should we support Windows? (act has Windows support but may have limitations)
5. **Multi-workflow execution**: Should users be able to queue multiple workflows or run them in parallel?

---

## Success Metrics

After implementation, track:
- **Setup completion rate**: % of users who successfully run their first workflow
- **Time to first workflow**: Average time from app install to first successful run
- **Error rate**: % of workflow runs that fail due to configuration issues
- **Support tickets**: Number of ACT-related support requests

**Target**:
- 90%+ setup completion rate
- <5 minutes to first workflow
- <5% configuration error rate

---

## References

- [nektos/act GitHub](https://github.com/nektos/act)
- [act Documentation](https://nektosact.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [catthehacker Docker Images](https://github.com/catthehacker/docker_images)

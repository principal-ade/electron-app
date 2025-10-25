# GitHub SSH Key Management with CLI and API

## Table of Contents
1. [Overview](#overview)
2. [GitHub CLI (gh) Capabilities](#github-cli-gh-capabilities)
3. [GitHub REST API Endpoints](#github-rest-api-endpoints)
4. [Authentication Methods](#authentication-methods)
5. [Complete Workflow Examples](#complete-workflow-examples)
6. [Security Considerations](#security-considerations)
7. [Limitations and Gotchas](#limitations-and-gotchas)

---

## Overview

GitHub provides multiple methods for programmatically managing SSH keys:
- **GitHub CLI (`gh`)**: High-level command-line tool with built-in authentication
- **REST API**: Direct API access for fine-grained control
- Both methods support OAuth token authentication

---

## GitHub CLI (gh) Capabilities

### Available Commands

#### 1. SSH Key Management
```bash
# List SSH keys
gh ssh-key list

# Add/upload SSH key
gh ssh-key add [<key-file>] [flags]
  -t, --title string   Title for the new key
  --type string        Type: {authentication|signing} (default: authentication)

# Delete SSH key
gh ssh-key delete <key-id>
```

#### 2. Authentication Commands
```bash
# Login with token from stdin
gh auth login --with-token < token.txt

# Login interactively
gh auth login
  -p, --git-protocol string   Protocol: {ssh|https}
  -h, --hostname string       GitHub instance hostname
  -w, --web                   Browser authentication
  --skip-ssh-key              Skip SSH key generation prompt

# Check authentication status
gh auth status

# Get current token
gh auth token

# Refresh/add scopes
gh auth refresh --scopes write:public_key,admin:public_key

# Setup git credential helper
gh auth setup-git [--hostname string]
```

#### 3. Direct API Access
```bash
# Make authenticated API calls
gh api <endpoint> [flags]
  -X, --method string         HTTP method (default: GET)
  -F, --field key=value       Typed parameter
  -f, --raw-field key=value   String parameter
  -H, --header key:value      HTTP header
  --jq string                 jq query for output
  --paginate                  Fetch all pages

# Example: List SSH keys
gh api /user/keys --jq '.[] | {id, title, created_at}'

# Example: Create SSH key
gh api /user/keys -X POST \
  -f title="My New Key" \
  -f key="ssh-ed25519 AAAA..."
```

### Authentication with Existing OAuth Token

#### Method 1: Environment Variable
```bash
export GH_TOKEN="gho_your_token_here"
gh ssh-key list
```

#### Method 2: Stdin Login
```bash
echo "gho_your_token_here" | gh auth login --with-token
```

#### Method 3: File-based Login
```bash
gh auth login --with-token < token.txt
```

**Note**: The token is stored securely in the system keyring (or fallback to `~/.config/gh/hosts.yml` if keyring unavailable).

---

## GitHub REST API Endpoints

### Base Information
- **Base URL**: `https://api.github.com`
- **API Version Header**: `X-GitHub-Api-Version: 2022-11-28`
- **Accept Header**: `Accept: application/vnd.github+json`
- **Auth Header**: `Authorization: Bearer <token>`

### SSH Key Endpoints (Authentication Keys)

#### 1. List User's SSH Keys
```http
GET /user/keys
```
**OAuth Scope**: `read:public_key`

**Query Parameters**:
- `per_page` (integer, default: 30)
- `page` (integer, default: 1)

**Response**: 200 OK
```json
[
  {
    "id": 115078016,
    "key": "ssh-ed25519 AAAAC3Nza...",
    "url": "https://api.github.com/user/keys/115078016",
    "title": "My SSH Key",
    "created_at": "2025-01-14T00:03:26Z",
    "verified": true,
    "read_only": false,
    "last_used": "2025-10-24T18:29:49Z"
  }
]
```

#### 2. Create SSH Key
```http
POST /user/keys
```
**OAuth Scope**: `write:public_key`

**Request Body**:
```json
{
  "title": "My New Key",
  "key": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... user@example.com"
}
```

**Response**: 201 Created
```json
{
  "id": 123456789,
  "key": "ssh-ed25519 AAAAC3Nza...",
  "title": "My New Key",
  "created_at": "2025-10-24T12:00:00Z",
  "verified": true
}
```

#### 3. Get Specific SSH Key
```http
GET /user/keys/{key_id}
```
**OAuth Scope**: `read:public_key`

**Path Parameters**:
- `key_id` (integer, required)

**Response**: 200 OK

#### 4. Delete SSH Key
```http
DELETE /user/keys/{key_id}
```
**OAuth Scope**: `admin:public_key`

**Path Parameters**:
- `key_id` (integer, required)

**Response**: 204 No Content

#### 5. List Public Keys for Any User
```http
GET /users/{username}/keys
```
**OAuth Scope**: None required (public endpoint)

**Path Parameters**:
- `username` (string, required)

**Note**: Returns only verified keys. Accessible by anyone.

### SSH Signing Key Endpoints (Commit Signing)

Similar structure but different endpoints:
- `GET /user/ssh_signing_keys` - List signing keys (`read:ssh_signing_key`)
- `POST /user/ssh_signing_keys` - Create signing key (`write:ssh_signing_key`)
- `GET /user/ssh_signing_keys/{id}` - Get signing key (`read:ssh_signing_key`)
- `DELETE /user/ssh_signing_keys/{id}` - Delete signing key (`admin:ssh_signing_key`)

---

## Authentication Methods

### Required OAuth Scopes

| Operation | Required Scope | Notes |
|-----------|---------------|-------|
| List keys | `read:public_key` | Can list own keys |
| Create key | `write:public_key` | Implies read access |
| Read key details | `read:public_key` | Get specific key info |
| Delete key | `admin:public_key` | Highest privilege |
| Signing keys | `*:ssh_signing_key` | Separate scope family |

### Scope Hierarchy
- `read:public_key` - Read-only access
- `write:public_key` - Read + Create access
- `admin:public_key` - Full access (read, create, delete)

### Adding Scopes to Existing Token
```bash
# Add scopes to gh authentication
gh auth refresh --scopes admin:public_key,write:public_key

# For signing keys
gh auth refresh --scopes admin:ssh_signing_key
```

---

## Complete Workflow Examples

### Example 1: Using GitHub CLI (Recommended)

```bash
#!/bin/bash
# Complete workflow with gh CLI

set -e

OAUTH_TOKEN="your_oauth_token_here"
KEY_TITLE="Auto-Generated Key $(date +%Y-%m-%d)"

# Step 1: Authenticate gh with OAuth token
echo "Authenticating with GitHub..."
echo "$OAUTH_TOKEN" | gh auth login --with-token

# Step 2: Verify authentication
gh auth status

# Step 3: Generate SSH key
echo "Generating SSH key..."
SSH_KEY_PATH="$HOME/.ssh/github_$(date +%s)"
ssh-keygen -t ed25519 -C "auto-generated@github" -f "$SSH_KEY_PATH" -N ""

# Step 4: Upload SSH key to GitHub
echo "Uploading SSH key to GitHub..."
gh ssh-key add "$SSH_KEY_PATH.pub" --title "$KEY_TITLE"

# Step 5: Configure Git to use GitHub CLI credential helper
echo "Configuring Git..."
gh auth setup-git

# Step 6: Add key to ssh-agent
echo "Adding key to ssh-agent..."
eval "$(ssh-agent -s)"
ssh-add "$SSH_KEY_PATH"

# Step 7: Update SSH config
echo "Updating SSH config..."
cat >> "$HOME/.ssh/config" <<EOF

Host github.com
    HostName github.com
    User git
    IdentityFile $SSH_KEY_PATH
    IdentitiesOnly yes
EOF

# Step 8: Test SSH connection
echo "Testing SSH connection..."
ssh -T git@github.com 2>&1 || true

echo "Setup complete!"
echo "SSH Key: $SSH_KEY_PATH"
```

### Example 2: Using REST API Directly

```bash
#!/bin/bash
# Using GitHub REST API directly

OAUTH_TOKEN="your_oauth_token_here"
API_BASE="https://api.github.com"

# Headers
AUTH="Authorization: Bearer $OAUTH_TOKEN"
ACCEPT="Accept: application/vnd.github+json"
VERSION="X-GitHub-Api-Version: 2022-11-28"

# Step 1: Generate SSH key
SSH_KEY_PATH="/tmp/github_key_$(date +%s)"
ssh-keygen -t ed25519 -C "api@github" -f "$SSH_KEY_PATH" -N ""
SSH_PUBLIC_KEY=$(cat "$SSH_KEY_PATH.pub")

# Step 2: Upload SSH key via API
echo "Uploading SSH key..."
RESPONSE=$(curl -s -X POST \
  -H "$AUTH" \
  -H "$ACCEPT" \
  -H "$VERSION" \
  -H "Content-Type: application/json" \
  "$API_BASE/user/keys" \
  -d "{\"title\":\"API Generated Key\",\"key\":\"$SSH_PUBLIC_KEY\"}")

KEY_ID=$(echo "$RESPONSE" | jq -r '.id')
echo "Key created with ID: $KEY_ID"

# Step 3: Verify key was created
echo "Verifying key..."
curl -s -H "$AUTH" \
  -H "$ACCEPT" \
  -H "$VERSION" \
  "$API_BASE/user/keys/$KEY_ID" | jq '{id, title, created_at, verified}'

# Step 4: List all keys
echo "Listing all keys..."
curl -s -H "$AUTH" \
  -H "$ACCEPT" \
  -H "$VERSION" \
  "$API_BASE/user/keys" | jq '.[] | {id, title}'
```

### Example 3: Using gh API Command (Hybrid Approach)

```bash
#!/bin/bash
# Using gh api for authenticated requests

OAUTH_TOKEN="your_oauth_token_here"

# Authenticate
echo "$OAUTH_TOKEN" | gh auth login --with-token

# Generate key
SSH_KEY_PATH="$HOME/.ssh/github_api_$(date +%s)"
ssh-keygen -t ed25519 -C "gh-api@github" -f "$SSH_KEY_PATH" -N ""
SSH_PUBLIC_KEY=$(cat "$SSH_KEY_PATH.pub")

# Upload using gh api
echo "Uploading key..."
gh api /user/keys -X POST \
  -f title="GH API Generated" \
  -f key="$SSH_PUBLIC_KEY" | jq '{id, title, created_at}'

# List keys
echo "Current keys:"
gh api /user/keys --jq '.[] | {id, title, created_at}'

# Get specific key (use first key for demo)
KEY_ID=$(gh api /user/keys --jq '.[0].id')
gh api "/user/keys/$KEY_ID" | jq '{id, title, last_used, verified}'
```

### Example 4: Programmatic Clone Setup

```bash
#!/bin/bash
# Setup SSH for cloning repositories

OAUTH_TOKEN="your_oauth_token_here"
REPO_URL="git@github.com:owner/repo.git"

# Setup function
setup_github_ssh() {
  local token="$1"

  # Authenticate
  echo "$token" | gh auth login --with-token

  # Generate dedicated key
  local key_path="$HOME/.ssh/github_clone_$(date +%s)"
  ssh-keygen -t ed25519 -C "clone@github" -f "$key_path" -N ""

  # Upload key
  gh ssh-key add "$key_path.pub" --title "Clone Key $(date +%Y-%m-%d)"

  # Configure SSH
  cat >> "$HOME/.ssh/config" <<EOF

Host github.com
    HostName github.com
    User git
    IdentityFile $key_path
    IdentitiesOnly yes
    AddKeysToAgent yes
EOF

  # Add to agent
  eval "$(ssh-agent -s)"
  ssh-add "$key_path"

  echo "SSH setup complete. Key path: $key_path"
}

# Execute setup
setup_github_ssh "$OAUTH_TOKEN"

# Test with clone
echo "Testing clone..."
git clone "$REPO_URL" /tmp/test_clone
```

---

## Security Considerations

### Best Practices

#### 1. Key Algorithm Selection
```bash
# Recommended: Ed25519 (modern, secure, fast)
ssh-keygen -t ed25519 -C "user@example.com" -f ~/.ssh/github_ed25519

# Alternative: RSA 4096-bit (widely compatible)
ssh-keygen -t rsa -b 4096 -C "user@example.com" -f ~/.ssh/github_rsa
```

**Why Ed25519?**
- Shorter keys with equivalent security to RSA 4096
- Faster key generation and verification
- Better resistance to side-channel attacks
- GitHub now supports post-quantum hybrid (sntrup761x25519-sha512)

#### 2. Key Passphrase Protection
```bash
# Always use a passphrase for private keys
ssh-keygen -t ed25519 -C "user@example.com" -f ~/.ssh/github_ed25519
# When prompted, enter a strong passphrase

# Use ssh-agent to avoid repeated passphrase entry
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/github_ed25519
```

#### 3. Separate Keys for Different Purposes
```bash
# Authentication key
ssh-keygen -t ed25519 -C "auth@github" -f ~/.ssh/github_auth

# Signing key (for commit verification)
ssh-keygen -t ed25519 -C "signing@github" -f ~/.ssh/github_signing

# Upload authentication key
gh ssh-key add ~/.ssh/github_auth.pub --title "Auth Key" --type authentication

# Upload signing key
gh ssh-key add ~/.ssh/github_signing.pub --title "Signing Key" --type signing
```

#### 4. Key Rotation
- Rotate SSH keys every 1-2 years
- Embed year in key name for tracking: `github_2025`
- Remove old keys from GitHub after rotation

```bash
# List keys with IDs
gh ssh-key list

# Delete old key
gh ssh-key delete <key-id>

# Or via API
gh api -X DELETE /user/keys/<key-id>
```

#### 5. Token Security
```bash
# NEVER commit tokens to git
echo "*.token" >> .gitignore
echo ".env" >> .gitignore

# Use environment variables
export GH_TOKEN="gho_..."
gh api /user/keys

# Clear token from history
unset GH_TOKEN

# For automation, use GitHub Actions secrets
# In workflow: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 6. Minimal Scope Principle
```bash
# Only request necessary scopes
# For SSH key management only:
gh auth refresh --scopes read:public_key,write:public_key

# For full management including deletion:
gh auth refresh --scopes admin:public_key

# Check current scopes
gh auth status
```

### Security Warnings

#### 1. SSH Config Security
```bash
# Set proper permissions on SSH files
chmod 700 ~/.ssh
chmod 600 ~/.ssh/config
chmod 600 ~/.ssh/github_*
chmod 644 ~/.ssh/github_*.pub
```

#### 2. Private Key Storage
```bash
# NEVER share or commit private keys
# Private keys should only be on the machine that uses them
# Consider hardware security keys (YubiKey, etc.) for critical accounts

# Check for accidentally committed keys
git log --all --full-history -- "*.pem" "*.key" "*_rsa" "*_ed25519"
```

#### 3. Key Verification
```bash
# Always verify key fingerprint after upload
ssh-keygen -lf ~/.ssh/github_ed25519.pub

# Compare with GitHub
gh api /user/keys --jq '.[] | {title, key}'
```

---

## Limitations and Gotchas

### 1. Organization Access Limitation

**CRITICAL LIMITATION**: SSH keys uploaded via OAuth token **do not grant access to organization repositories**.

```bash
# Keys uploaded programmatically can access:
# ✓ Personal repositories
# ✗ Organization repositories (even if user has access)

# Workaround: Users must manually add keys via web UI for org access
# Or use interactive gh auth login which generates keys differently
```

### 2. Token Scope Requirements

```bash
# This will fail - insufficient scope
GH_TOKEN="token_with_repo_scope_only" gh ssh-key add key.pub
# Error: HTTP 403: Resource not accessible by integration

# Need write:public_key scope
gh auth refresh --scopes write:public_key
gh ssh-key add key.pub  # Now works
```

### 3. Key Title Uniqueness

```bash
# GitHub allows duplicate key titles (but not duplicate keys)
gh ssh-key add key1.pub --title "My Key"
gh ssh-key add key2.pub --title "My Key"  # Works - same title, different keys

# But same key content is rejected
gh ssh-key add key1.pub --title "First"
gh ssh-key add key1.pub --title "Second"  # Fails - duplicate key
```

### 4. API Rate Limits

```bash
# Check rate limit
gh api /rate_limit

# Primary rate limit: 5,000 requests/hour (authenticated)
# Secondary rate limits apply for rapid requests

# Best practice: Cache key list, don't fetch repeatedly
gh api /user/keys > keys_cache.json
```

### 5. SSH vs HTTPS Protocol

```bash
# After adding SSH key, configure git protocol
gh auth setup-git

# Check current protocol
git config --get credential.helper
# Should show: gh auth git-credential-helper

# For SSH cloning
git config --global url."git@github.com:".insteadOf "https://github.com/"

# For HTTPS cloning (using gh credential helper)
git config --global credential.helper "$(gh auth git-credential-helper)"
```

### 6. Key Type Distinction

```bash
# Authentication keys (for git operations)
gh ssh-key add key.pub --type authentication

# Signing keys (for commit verification)
gh ssh-key add key.pub --type signing

# They are managed separately with different scopes
# admin:public_key - for auth keys
# admin:ssh_signing_key - for signing keys

# Check both types
gh ssh-key list  # Shows both, but may need separate scopes
```

### 7. Key Verification Status

```json
// Keys start as "unverified" until first use
{
  "id": 123,
  "verified": false,  // Initially
  "last_used": null
}

// After first successful use
{
  "id": 123,
  "verified": true,   // Now verified
  "last_used": "2025-10-24T12:00:00Z"
}
```

### 8. SSH Config Conflicts

```bash
# Multiple SSH configs can conflict
# ~/.ssh/config entries are processed in order

# Be specific with Host patterns
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_specific
    IdentitiesOnly yes  # Important: prevents trying other keys

# Without IdentitiesOnly, ssh tries all keys in agent
# This can cause rate limiting or authentication issues
```

### 9. Windows-Specific Considerations

```powershell
# Windows uses different paths
$env:GH_TOKEN = "gho_..."
gh ssh-key add "$env:USERPROFILE\.ssh\github.pub"

# SSH agent on Windows
# Start ssh-agent service
Start-Service ssh-agent
Set-Service -Name ssh-agent -StartupType Automatic

# Add key
ssh-add $env:USERPROFILE\.ssh\github
```

### 10. Container/CI Environments

```yaml
# GitHub Actions example
jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - name: Setup SSH
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/github
          chmod 600 ~/.ssh/github

          # Upload public key (if not already uploaded)
          ssh-keygen -y -f ~/.ssh/github > ~/.ssh/github.pub
          gh ssh-key add ~/.ssh/github.pub --title "CI Key" || true

          # Configure SSH
          cat >> ~/.ssh/config <<EOF
          Host github.com
            HostName github.com
            User git
            IdentityFile ~/.ssh/github
            StrictHostKeyChecking no
          EOF
```

---

## Quick Reference

### Generate & Upload SSH Key (One-liner)

```bash
# Using gh CLI
ssh-keygen -t ed25519 -f ~/.ssh/gh_auto -N "" && \
gh ssh-key add ~/.ssh/gh_auto.pub --title "Auto $(date +%Y-%m-%d)"

# Using API with curl
ssh-keygen -t ed25519 -f /tmp/gh_key -N "" && \
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/user/keys \
  -d "{\"title\":\"API Key\",\"key\":\"$(cat /tmp/gh_key.pub)\"}"
```

### Check Token Scopes

```bash
# Via gh
gh auth status

# Via API
curl -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/user | jq -r '.scopes'

# Check in response headers
curl -I -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/user/keys | grep "x-oauth-scopes"
```

### Delete All SSH Keys (Dangerous!)

```bash
# List and confirm first
gh ssh-key list

# Delete all (interactive confirmation)
gh api /user/keys --jq '.[].id' | while read id; do
  echo "Delete key $id? (y/n)"
  read confirm
  [[ "$confirm" == "y" ]] && gh api -X DELETE "/user/keys/$id"
done
```

---

## Summary

### Can gh create and upload SSH keys programmatically?
**YES** - `gh ssh-key add` can upload existing keys. However, gh cannot generate keys itself; you must use `ssh-keygen` separately.

### What gh ssh-key commands are available?
- `gh ssh-key list` - List keys
- `gh ssh-key add` - Upload keys (with --title and --type flags)
- `gh ssh-key delete` - Remove keys

### Can we authenticate gh using an existing OAuth token?
**YES** - Multiple methods:
1. `echo "$TOKEN" | gh auth login --with-token`
2. `export GH_TOKEN="$TOKEN"` (environment variable)
3. `gh auth login --with-token < token.txt` (file-based)

### What's the workflow for generate -> upload -> configure?
```bash
# 1. Authenticate
echo "$TOKEN" | gh auth login --with-token

# 2. Generate
ssh-keygen -t ed25519 -f ~/.ssh/github -N ""

# 3. Upload
gh ssh-key add ~/.ssh/github.pub --title "My Key"

# 4. Configure
gh auth setup-git
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/github
```

### Are there limitations or security considerations?
**YES** - Key limitations:
- OAuth-uploaded keys **cannot access organization repositories**
- Requires proper OAuth scopes (write:public_key, admin:public_key)
- Rate limits apply (5,000 requests/hour)
- Keys should be rotated regularly (1-2 years)
- Use Ed25519 algorithm for modern security
- Always protect private keys with passphrases
- Separate keys for different purposes

### GitHub REST API for SSH keys?
**YES** - Full REST API available:
- `POST /user/keys` - Create (requires write:public_key)
- `GET /user/keys` - List (requires read:public_key)
- `GET /user/keys/{id}` - Get specific (requires read:public_key)
- `DELETE /user/keys/{id}` - Delete (requires admin:public_key)
- All require Bearer token authentication
- API version: 2022-11-28

---

## Additional Resources

- [GitHub SSH Keys Documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [GitHub REST API - SSH Keys](https://docs.github.com/en/rest/users/keys)
- [GitHub CLI Manual](https://cli.github.com/manual)
- [OAuth Scopes Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps)
- [SSH Key Best Practices](https://www.brandonchecketts.com/archives/ssh-ed25519-key-best-practices-for-2025)

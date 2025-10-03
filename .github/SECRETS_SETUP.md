# GitHub Secrets Setup for Mac Publishing

This document explains how to set up the required GitHub secrets for the Mac publishing workflow.

## Required Secrets

Go to your repository settings → Secrets and variables → Actions → New repository secret, and add the following:

### 1. Apple Developer Secrets

#### `APPLE_ID`
- Your Apple ID email address
- Example: `your.email@example.com`
- Current value from .env: `laguna.loire.2024@gmail.com`

#### `APPLE_ID_PASS`
- Your app-specific password for the Apple ID
- Generate at: https://appleid.apple.com/account/manage → App-Specific Passwords
- Current value from .env: `ageb-omed-aidh-lpgw`

#### `APPLE_APP_SPECIFIC_PASSWORD`
- Same as `APPLE_ID_PASS` (some scripts use this name)
- Current value from .env: `ageb-omed-aidh-lpgw`

#### `APPLE_TEAM_ID`
- Your Apple Developer Team ID
- Find at: https://developer.apple.com/account → Membership
- Current value from .env: `4TNFXHR5WN`

#### `APPLE_IDENTITY`
- Your Developer ID Application certificate name
- Format: `Developer ID Application: Your Name (TEAM_ID)`
- Current value from .env: `Developer ID Application: Fernando Ramirez (4TNFXHR5WN)`

### 2. Code Signing Certificate

#### `APPLE_CERTIFICATE`
- Base64-encoded .p12 certificate file
- To generate:
  ```bash
  # Export certificate from Keychain Access as .p12 file
  # Then convert to base64:
  base64 -i YourCertificate.p12 | pbcopy
  # Paste the output as the secret value
  ```

#### `APPLE_CERTIFICATE_PASSWORD`
- The password you set when exporting the .p12 certificate

### 3. GitHub Token

The workflow uses `GITHUB_TOKEN` which is automatically provided by GitHub Actions.
No need to create this secret manually.

## Exporting Your Code Signing Certificate

1. Open **Keychain Access** on your Mac
2. Select **login** keychain
3. Select **My Certificates** category
4. Find your "Developer ID Application" certificate
5. Right-click → Export
6. Save as .p12 format
7. Set a strong password (this becomes `APPLE_CERTIFICATE_PASSWORD`)
8. Convert to base64:
   ```bash
   base64 -i /path/to/certificate.p12 | pbcopy
   ```
9. Paste into GitHub as `APPLE_CERTIFICATE` secret

## Triggering the Workflow

### Automatic (on tag push):
```bash
git tag v1.0.0
git push origin v1.0.0
```

### Manual (workflow_dispatch):
1. Go to Actions tab in GitHub
2. Select "Publish Mac App" workflow
3. Click "Run workflow"
4. Choose whether to publish or just build

## Security Notes

- **Never commit the .env file** to version control
- Rotate your app-specific password regularly
- The certificate password should be strong and unique
- GitHub Secrets are encrypted and only exposed to workflow runs

#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}PrincipleMD Multi-Platform Release Builder${NC}"
echo "============================================"

# Check for required environment variables
if [ -z "$GH_TOKEN" ]; then
    echo -e "${RED}Error: GH_TOKEN environment variable is not set${NC}"
    echo "Please set it with: export GH_TOKEN=your_github_token"
    echo "Create a token at: https://github.com/settings/tokens"
    exit 1
fi

# Increment patch version
echo -e "${YELLOW}Incrementing patch version...${NC}"
NEW_VERSION=$(node scripts/increment-version.js)
echo -e "${GREEN}Version incremented to $NEW_VERSION${NC}"

# Commit the version change
echo -e "${YELLOW}Committing version change...${NC}"
git add package.json
git commit -m "Bump version to $NEW_VERSION"

# Get version from package.json (now updated)
VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}Building version $VERSION for all platforms...${NC}"

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf release/build/*

# Build core dependencies first
echo -e "${YELLOW}Building core dependencies...${NC}"
(cd ../core && npm run build:agents)

# Build for Mac (if on Mac)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}Building for Mac...${NC}"
    npm run package:mac:npm
    echo -e "${GREEN}✓ Mac build complete${NC}"
fi

# Build for Linux
echo -e "${YELLOW}Building for Linux...${NC}"
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
    npm run package:linux
    echo -e "${GREEN}✓ Linux build complete${NC}"
else
    echo -e "${RED}Skipping Linux build (not on Mac/Linux)${NC}"
fi

# Build for Windows using Docker
echo -e "${YELLOW}Building for Windows using Docker...${NC}"
if command -v docker &> /dev/null; then
    # Check if Docker is running
    if docker info &> /dev/null; then
        docker-compose -f docker-compose.windows.yml run --rm electron-win npm run package:windows
        echo -e "${GREEN}✓ Windows build complete${NC}"
    else
        echo -e "${RED}Docker is not running. Please start Docker Desktop.${NC}"
        exit 1
    fi
else
    echo -e "${RED}Docker is not installed. Please install Docker Desktop.${NC}"
    echo "Download from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo -e "${GREEN}All builds completed successfully!${NC}"
echo -e "${YELLOW}Build artifacts:${NC}"
ls -la release/build/

# Calculate total size
TOTAL_SIZE=$(du -sh release/build/ | cut -f1)
echo -e "${YELLOW}Total size: $TOTAL_SIZE${NC}"

# Create git tag and push
echo -e "${YELLOW}Creating and pushing git tag v$VERSION...${NC}"
git tag "v$VERSION"
git push origin "v$VERSION"
echo -e "${GREEN}✓ Tag v$VERSION created and pushed${NC}"

# Optional: Create GitHub release
echo ""
read -p "Do you want to create a GitHub release? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Creating GitHub release...${NC}"

    # Check if gh CLI is installed
    if command -v gh &> /dev/null; then
        # Create GitHub release
        gh release create "v$VERSION" \
            --title "Principal AI v$VERSION" \
            --notes "## What's New

### Features
- Multi-platform support (Mac, Linux, Windows)
- Auto-update functionality
- Improved performance

### Downloads
- **Mac**: Download the .dmg file
- **Linux**: Download the .AppImage file
- **Windows**: Download the .exe file

### Installation
See the [installation guide](https://github.com/a24z-ai/electron-app/blob/main/README.md) for platform-specific instructions.
" \
            release/build/*.dmg \
            release/build/*.AppImage \
            release/build/*.exe \
            release/build/latest*.yml

        echo -e "${GREEN}✓ GitHub release created successfully!${NC}"
        echo "View at: https://github.com/a24z-ai/electron-app/releases/tag/v$VERSION"
    else
        echo -e "${YELLOW}GitHub CLI not found. Using electron-builder publish instead...${NC}"
        GH_TOKEN=$GH_TOKEN npm run publish
    fi
fi

echo -e "${GREEN}Release process complete!${NC}"
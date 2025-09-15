# Layer Configuration Files

This directory contains configuration files for the layer analysis system.

## Files

- `layer-templates.json` - Templates for generating dynamic layers based on file content
- `scan-filters.json` - Filters applied during filesystem scanning for performance
- `default-layers.json` - Static layer definitions based on file patterns

## Usage

These configurations are loaded from GitHub to ensure consistency across different environments (Electron app, web app, etc.).

### For Voyager-Guides Repository

Copy these configuration files to your repository at:
```
https://github.com/The-Code-Cosmos/Voyager-Guides/tree/main/configs/
```

The layer system will automatically fetch them from there.
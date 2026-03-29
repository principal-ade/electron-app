# Bruno Collection Validation API

This document outlines how to add HTTP validation routes for Bruno collections and `.bru` files to the electron-app. The design uses an adapter pattern to allow future extraction to a standalone CLI tool.

## Background

Currently, the electron-app uses:
- **`@principal-ade/bruno-panels`** for parsing `.bru` files (browser-safe)
- **`@usebruno/requests`** for HTTP execution only (no parsing/validation)

There is no validation layer - `BrunoRequest` objects are assumed to be well-formed. This proposal adds validation capabilities that can be consumed via HTTP (for agents) and later via CLI.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Consumers                                 │
├──────────────────┬──────────────────┬───────────────────────────┤
│   HTTP Routes    │   IPC Handlers   │   CLI (future)            │
│ (agents/external)│   (renderer)     │   (standalone tool)       │
└────────┬─────────┴────────┬─────────┴─────────────┬─────────────┘
         │                  │                       │
         └──────────────────┼───────────────────────┘
                            ▼
              ┌─────────────────────────┐
              │  BrunoValidationService │
              │  (core validation logic)│
              └───────────┬─────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
│ FileAdapter │  │ ParserAdapter│  │ SchemaValidator │
│ (interface) │  │ (interface)  │  │                 │
└─────────────┘  └─────────────┘  └─────────────────┘
```

## Key Files Reference

### Existing Infrastructure

| File | Purpose |
|------|---------|
| `src/main/principal-mcp/PrincipalMCPBridge.ts` | Express server - add routes here |
| `src/main/bruno/bruno-actions.ts` | HTTP request executor - no validation currently |
| `src/main/bruno/brunoHandlers.ts` | IPC handler registration |
| `src/shared/main-process-api-interfaces/BrunoAPI.ts` | TypeScript interfaces for `BrunoRequest` |
| `src/window/main-process-api-implementations/brunoApi.ts` | Preload API bridge |

### Patterns to Follow

| File | Pattern |
|------|---------|
| `src/main/adapters/GitHubFileSystemAdapter.ts` | Adapter pattern for file operations |
| `src/main/services/CollectionsService.ts` | Singleton service with IPC registration |

## Implementation Plan

### Step 1: Define Adapter Interfaces

Create `src/main/bruno/adapters/interfaces.ts`:

```typescript
/**
 * File system adapter interface - allows swapping between
 * Electron fs, GitHub API, or CLI file access
 */
export interface IFileAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readDir(path: string): Promise<string[]>;
  isDirectory(path: string): Promise<boolean>;
}

/**
 * Parser adapter interface - abstracts .bru parsing
 * Allows swapping between @usebruno/lang (Node) and
 * @principal-ade/bruno-panels (browser-safe)
 */
export interface IParserAdapter {
  parseBruFile(content: string): Promise<ParseResult>;
  serializeToBru(request: BrunoRequest): Promise<string>;
}

export interface ParseResult {
  success: boolean;
  request?: BrunoRequest;
  errors?: ValidationError[];
}

export interface ValidationError {
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface CollectionValidationResult {
  valid: boolean;
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  results: Map<string, ValidationResult>;
}
```

### Step 2: Create Validation Service

Create `src/main/bruno/BrunoValidationService.ts`:

```typescript
import { IFileAdapter, IParserAdapter, ValidationResult, CollectionValidationResult } from './adapters/interfaces';

export class BrunoValidationService {
  constructor(
    private fileAdapter: IFileAdapter,
    private parserAdapter: IParserAdapter
  ) {}

  /**
   * Validate a single .bru file content
   */
  async validateBruContent(content: string): Promise<ValidationResult> {
    const result = await this.parserAdapter.parseBruFile(content);
    return {
      valid: result.success,
      errors: result.errors?.filter(e => e.severity === 'error') ?? [],
      warnings: result.errors?.filter(e => e.severity === 'warning') ?? []
    };
  }

  /**
   * Validate a .bru file by path
   */
  async validateBruFile(filePath: string): Promise<ValidationResult> {
    const content = await this.fileAdapter.readFile(filePath);
    return this.validateBruContent(content);
  }

  /**
   * Validate an entire collection directory
   */
  async validateCollection(collectionPath: string): Promise<CollectionValidationResult> {
    const results = new Map<string, ValidationResult>();
    const bruFiles = await this.findBruFiles(collectionPath);

    let validFiles = 0;
    let invalidFiles = 0;

    for (const file of bruFiles) {
      const result = await this.validateBruFile(file);
      results.set(file, result);
      if (result.valid) {
        validFiles++;
      } else {
        invalidFiles++;
      }
    }

    return {
      valid: invalidFiles === 0,
      totalFiles: bruFiles.length,
      validFiles,
      invalidFiles,
      results
    };
  }

  /**
   * Parse .bru content to BrunoRequest JSON
   */
  async parseBruToJson(content: string): Promise<ParseResult> {
    return this.parserAdapter.parseBruFile(content);
  }

  private async findBruFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await this.fileAdapter.readDir(dirPath);

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry}`;
      if (await this.fileAdapter.isDirectory(fullPath)) {
        files.push(...await this.findBruFiles(fullPath));
      } else if (entry.endsWith('.bru')) {
        files.push(fullPath);
      }
    }

    return files;
  }
}
```

### Step 3: Implement Adapters

#### Electron File Adapter

Create `src/main/bruno/adapters/ElectronFileAdapter.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';
import { IFileAdapter } from './interfaces';

export class ElectronFileAdapter implements IFileAdapter {
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readDir(dirPath: string): Promise<string[]> {
    return fs.readdir(dirPath);
  }

  async isDirectory(filePath: string): Promise<boolean> {
    const stat = await fs.stat(filePath);
    return stat.isDirectory();
  }
}
```

#### Parser Adapter (using bruno-panels)

Create `src/main/bruno/adapters/BrunoPanelsParserAdapter.ts`:

```typescript
import { IParserAdapter, ParseResult } from './interfaces';
// Import parsing utilities from @principal-ade/bruno-panels
// Note: May need to expose additional parsing functions from bruno-panels

export class BrunoPanelsParserAdapter implements IParserAdapter {
  async parseBruFile(content: string): Promise<ParseResult> {
    try {
      // TODO: Import and use parsing from @principal-ade/bruno-panels
      // const request = parseBru(content);
      // return { success: true, request };

      throw new Error('Not implemented - needs bruno-panels parsing export');
    } catch (error) {
      return {
        success: false,
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown parse error',
          severity: 'error'
        }]
      };
    }
  }

  async serializeToBru(request: BrunoRequest): Promise<string> {
    // TODO: Import and use serialization from @principal-ade/bruno-panels
    throw new Error('Not implemented - needs bruno-panels serialization export');
  }
}
```

### Step 4: Add HTTP Routes

Add to `src/main/principal-mcp/PrincipalMCPBridge.ts` in `setupRoutes()`:

```typescript
import { BrunoValidationService } from '../bruno/BrunoValidationService';
import { ElectronFileAdapter } from '../bruno/adapters/ElectronFileAdapter';
import { BrunoPanelsParserAdapter } from '../bruno/adapters/BrunoPanelsParserAdapter';

// In setupRoutes():
private setupValidationRoutes() {
  const validationService = new BrunoValidationService(
    new ElectronFileAdapter(),
    new BrunoPanelsParserAdapter()
  );

  // Validate .bru file content
  this.app.post('/api/bruno/validate', async (req, res) => {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const result = await validationService.validateBruContent(content);
    res.json(result);
  });

  // Validate .bru file by path
  this.app.post('/api/bruno/validate/file', async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const result = await validationService.validateBruFile(filePath);
    res.json(result);
  });

  // Validate entire collection
  this.app.post('/api/bruno/validate/collection', async (req, res) => {
    const { collectionPath } = req.body;
    if (!collectionPath) {
      return res.status(400).json({ error: 'collectionPath is required' });
    }

    const result = await validationService.validateCollection(collectionPath);
    res.json({
      ...result,
      results: Object.fromEntries(result.results) // Convert Map for JSON
    });
  });

  // Parse .bru content to JSON
  this.app.post('/api/bruno/parse', async (req, res) => {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const result = await validationService.parseBruToJson(content);
    res.json(result);
  });
}
```

### Step 5: Add IPC Handlers (optional)

Add to `src/main/bruno/brunoHandlers.ts`:

```typescript
// Extend existing handlers
ipcMain.handle('bruno:validate', async (_, content: string) => {
  return validationService.validateBruContent(content);
});

ipcMain.handle('bruno:validateFile', async (_, filePath: string) => {
  return validationService.validateBruFile(filePath);
});

ipcMain.handle('bruno:validateCollection', async (_, collectionPath: string) => {
  return validationService.validateCollection(collectionPath);
});

ipcMain.handle('bruno:parse', async (_, content: string) => {
  return validationService.parseBruToJson(content);
});
```

## Future CLI Export

The adapter pattern allows easy extraction to a CLI:

```typescript
// cli/src/index.ts
import { BrunoValidationService } from './BrunoValidationService';
import { NodeFileAdapter } from './adapters/NodeFileAdapter';
import { UseBrunoLangParserAdapter } from './adapters/UseBrunoLangParserAdapter';

const service = new BrunoValidationService(
  new NodeFileAdapter(),           // Uses Node.js fs directly
  new UseBrunoLangParserAdapter()  // Uses @usebruno/lang (Node-only)
);

// CLI commands
program
  .command('validate <path>')
  .action(async (path) => {
    const result = await service.validateBruFile(path);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
  });

program
  .command('validate-collection <path>')
  .action(async (path) => {
    const result = await service.validateCollection(path);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
  });
```

## Dependencies on bruno-panels

The `@principal-ade/bruno-panels` package needs to export parsing utilities:

```typescript
// Needed exports from bruno-panels
export { parseBruFile } from './parser';
export { serializeToBru } from './serializer';
export type { BrunoRequest, ParseError } from './types';
```

## API Reference

### POST /api/bruno/validate

Validate `.bru` file content.

**Request:**
```json
{
  "content": "meta {\n  name: Get Users\n  type: http\n}\n\nget {\n  url: https://api.example.com/users\n}"
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

### POST /api/bruno/validate/file

Validate `.bru` file by path.

**Request:**
```json
{
  "filePath": "/path/to/request.bru"
}
```

### POST /api/bruno/validate/collection

Validate entire collection directory.

**Request:**
```json
{
  "collectionPath": "/path/to/collection"
}
```

**Response:**
```json
{
  "valid": false,
  "totalFiles": 10,
  "validFiles": 8,
  "invalidFiles": 2,
  "results": {
    "/path/to/collection/request1.bru": { "valid": true, "errors": [], "warnings": [] },
    "/path/to/collection/request2.bru": { "valid": false, "errors": [...], "warnings": [] }
  }
}
```

### POST /api/bruno/parse

Parse `.bru` content to `BrunoRequest` JSON.

**Request:**
```json
{
  "content": "..."
}
```

**Response:**
```json
{
  "success": true,
  "request": {
    "method": "GET",
    "url": "https://api.example.com/users",
    "headers": [],
    "params": []
  }
}
```

## Testing

```bash
# Validate content
curl -X POST http://localhost:${BRIDGE_PORT}/api/bruno/validate \
  -H "Content-Type: application/json" \
  -d '{"content": "meta {\n  name: Test\n  type: http\n}\n\nget {\n  url: https://example.com\n}"}'

# Validate collection
curl -X POST http://localhost:${BRIDGE_PORT}/api/bruno/validate/collection \
  -H "Content-Type: application/json" \
  -d '{"collectionPath": "/path/to/my-collection"}'
```

## Open Questions

1. **Parser source**: Should we use `@usebruno/lang` in main process (Node-only) or expose parsing from `@principal-ade/bruno-panels`?
2. **Schema validation**: Should we add JSON Schema validation for `BrunoRequest` objects beyond syntax parsing?
3. **OTEL instrumentation**: Should validation operations emit OTEL spans/events?

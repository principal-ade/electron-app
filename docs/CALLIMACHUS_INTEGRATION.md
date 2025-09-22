# Callimachus Integration Progress Report

## Date: 2025-09-21

## Overview
Integrated the Callimachus semantic code pattern discovery system into the Electron app. The integration allows users to search for code patterns using natural language queries, backed by Pixeltable as the vector database.

## Work Completed

### 1. UI Integration
- Created `CallimachusWindow` component with connection panel, search interface, and results display
- Implemented proper theming using `themed-markdown` and Tailwind CSS
- Added custom titlebar (`CallimachusTitlebar`) showing connection status
- Created IPC handlers following the app's existing pattern (WindowService → mainProcess → preload)
- Added book icon to main titlebar for launching the Callimachus window

### 2. Package Updates and Fixes
Published multiple versions of `@a24z/callimachus` to fix issues:
- **0.1.1**: Fixed initialization race condition by adding `ensureInitialized()` method
- **0.1.2**: Attempted to use array columns for embeddings (failed due to Pixeltable API limitations)
- **0.1.3**: Reverted to JSON columns for compatibility with Pixeltable API

Key fixes in Callimachus SDK:
- Added `ensureInitialized()` method to properly await table creation
- Added `checkInitialized()` to prevent operations before initialization
- Fixed async initialization that was causing race conditions

### 3. Backend Setup
- Set up Pixeltable server using Docker Compose
- Fixed event loop conflict by switching from `uvloop` to standard `asyncio`:
  ```python
  uvicorn.run(
      "pixeltable.api.server:app",
      loop="asyncio"  # Changed from default uvloop
  )
  ```
- Resolved `nest_asyncio` compatibility issues

### 4. Current State
- ✅ UI fully functional and styled
- ✅ Connection to Pixeltable works
- ✅ Table creation succeeds (using JSON columns)
- ✅ Browse operations work
- ❌ **Search fails**: Pixeltable doesn't support similarity search on JSON columns

## Critical Issue: Embedding Column Type Mismatch

### The Problem
Pixeltable has a fundamental architecture issue with embedding columns when accessed through the API:

1. **Via API**: Only supports basic types (`string`, `int`, `float`, `json`, etc.) - no native array/vector type
2. **Via Python SDK**: Supports `pxt.Array()` type that enables similarity search operations
3. **Result**: Tables created via API with JSON columns cannot perform `cosine_similarity()` operations

### Error Details
```
Error: () for an absolute path is invalid
Location: /pixeltable/exprs/json_path.py line 94
Cause: embedding_col.cosine_similarity() called on JSON column instead of Array column
```

## Required Fix

### Option 1: Fix Pixeltable API (Recommended)
Modify `/Users/griever/Developer/pixeltable/pixeltable/api/` to properly handle embedding columns:

1. **Update table creation endpoint** to accept and create Array columns:
   ```python
   # In routers/tables.py
   if column_type == 'embedding' or column_type == 'array':
       columns[name] = pxt.Array((dimension,), dtype=np.float32)
   ```

2. **Update search service** to handle embeddings properly:
   ```python
   # In services/search_service.py
   # Ensure the column is created as Array type, not JSON
   ```

3. **Add embedding column type** to the API schema:
   ```python
   # In models/table_models.py
   ColumnType = Literal['string', 'int', 'float', 'json', 'array', 'embedding', ...]
   ```

### Option 2: Workaround with Direct Table Creation
Create tables directly using Pixeltable Python SDK instead of through the API:
```python
import pixeltable as pxt
import numpy as np

pxt.create_table('alexandria_layouts', {
    'id': pxt.String,
    'teaches_embedding': pxt.Array((384,), dtype=np.float32),
    # ... other columns
})
```

### Option 3: Alternative Backend
Consider using a different vector database that has better API support:
- Pinecone
- Weaviate
- Qdrant
- ChromaDB

## Next Steps

1. **Immediate**: Fix Pixeltable API to properly support embedding columns
2. **Test**: Verify search functionality works with proper Array columns
3. **Ingest**: Add sample data to test pattern discovery
4. **Enhance**: Add more search options and filters to the UI
5. **Document**: Create user documentation for the pattern discovery feature

## Files Modified

### Electron App
- `/src/renderer/pages/CallimachusWindow/` - Main window and components
- `/src/main/window/modernWindowHandlers.ts` - IPC handler for opening window
- `/src/renderer/App.tsx` - Route handling for Callimachus window
- `/src/renderer/components/Titlebar/` - Added CallimachusTitlebar
- `/src/renderer/main-process-api/WindowService.ts` - Added window service method
- `/src/shared/ipc-events/WindowEvents.ts` - Added IPC event constant

### Callimachus SDK
- `/src/core/CallimachusClient.ts` - Fixed initialization race condition
- `/src/adapters/PixeltableAdapter.ts` - Updated column types (multiple times)
- `package.json` - Version bumps (0.1.0 → 0.1.3)

### Pixeltable
- `/pixeltable/api/__main__.py` - Fixed event loop configuration
- `/pixeltable/api/server.py` - Main API server (needs embedding column fix)
- `/pixeltable/api/routers/search.py` - Search endpoint (works but needs Array columns)
- `/pixeltable/api/services/search_service.py` - Search implementation

## Dependencies Installed
- `@a24z/callimachus@0.1.3` - Pattern discovery SDK
- `@a24z/pixeltable-sdk@0.4.1` - Pixeltable client SDK (installed as dependency)

## Testing Instructions

1. Ensure Pixeltable is running:
   ```bash
   cd /Users/griever/Developer/pixeltable
   docker compose up
   ```

2. Start the Electron app:
   ```bash
   npm start
   ```

3. Open Callimachus window (book icon in titlebar)
4. Connect with default settings (http://localhost:8000/api/v1)
5. Try searching (will fail until Pixeltable API is fixed)

## Conclusion

The UI integration is complete and functional. The only remaining blocker is Pixeltable's inability to handle embedding columns properly through its REST API. Once this is fixed, the semantic search feature will be fully operational.
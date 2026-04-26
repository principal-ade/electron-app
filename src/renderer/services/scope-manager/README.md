# scope-manager

Authoring layer for `.scopes.canvas` and `*.events.canvas` files.

The upstream `principal-view-core-library` ships *validators* and *parsers* but
no manager that mutates and persists scope/namespace state. This module fills
that gap so the dev-workspace UI has something to call into.

## Migration intent

This whole folder is designed to move into
`principal-view-core-library/packages/core/src/scopes/` (or a sibling
`scope-manager/` package) once the API is stable. To make that move clean:

- The model layer (`types.ts`, `model.ts`, `canvasIo.ts`, `ScopeStore.ts`,
  `ScopeManager.ts`, `adapters/InMemoryScopeStore.ts`) has **no electron-app
  imports** — only `@principal-ai/principal-view-core` and standard JS. These
  files lift-and-shift directly.
- Any I/O adapter that talks to electron specifics (e.g. a
  `CanvasFileScopeStore` using `FileSystemService`) must live under
  `adapters/` and stay behind here when the rest moves.

If you add code under this folder, keep that boundary.

## Shape

```
ScopeWorkspace
└── scopes: ScopeRecord[]                  ← .scopes.canvas
        ├── name (dotted, e.g. "principal-view.cli")
        ├── paths[]
        └── namespaces: NamespaceRecord[]  ← <scope>.events.canvas
                ├── name
                ├── paths[]
                └── events: EventRecord[]
```

One `.scopes.canvas` holds every scope. Each scope owns a separate
`<scope>.events.canvas` that holds its namespaces.

# @a24z/markdown-utils

Core markdown parsing and presentation utilities without React dependencies. Extract slides, parse chunks, and handle markdown transformations.

## Installation

```bash
npm install @a24z/markdown-utils
# or
bun add @a24z/markdown-utils
```

## Features

- 📝 **Markdown parsing** - Parse markdown into typed chunks
- 🎯 **Slide extraction** - Split markdown into presentation slides
- 🔌 **Extensible** - Plugin system for custom chunk types
- 🚀 **Zero React dependencies** - Pure TypeScript utilities
- 📦 **Lightweight** - ~15KB bundled

## Usage

### Parse Markdown into Chunks

```typescript
import { parseMarkdownChunks, CHUNK_TYPES } from '@a24z/markdown-utils';

const chunks = parseMarkdownChunks(markdownContent, 'my-prefix');

chunks.forEach(chunk => {
  if (chunk.type === CHUNK_TYPES.MERMAID) {
    // Handle mermaid diagram
    console.log('Mermaid:', chunk.content);
  }
});
```

### Create Presentation from Markdown

```typescript
import { parseMarkdownIntoPresentation, MarkdownPresentationFormat } from '@a24z/markdown-utils';

// Split by horizontal rules (---)
const presentation = parseMarkdownIntoPresentation(
  markdownContent,
  MarkdownPresentationFormat.HORIZONTAL_RULE
);

console.log(`${presentation.slides.length} slides found`);
```

### Extend with Custom Chunks

```typescript
import { BaseChunk, parseMarkdownChunks } from '@a24z/markdown-utils';

// Define custom chunk type
interface MathChunk extends BaseChunk<'math_chunk'> {
  formula: string;
}

// Custom parser
const mathParser = (content: string, idPrefix: string): MathChunk[] => {
  // Parse LaTeX math blocks...
  return [];
};

// Use with parser
const chunks = parseMarkdownChunks<MathChunk | ContentChunk>(
  content,
  'prefix',
  [mathParser]
);
```

## API

### Types

- `BaseChunk<T>` - Base interface for extensible chunks
- `MarkdownChunk`, `MermaidChunk`, `CodeChunk` - Built-in chunk types
- `MarkdownPresentation`, `MarkdownSlide` - Presentation types

### Functions

- `parseMarkdownChunks()` - Parse markdown into typed chunks
- `parseMarkdownIntoPresentation()` - Create presentation from markdown
- `extractSlideTitle()` - Extract title from slide content
- `parseBashCommands()` - Parse bash code blocks
- `transformImageUrl()` - Transform relative URLs to absolute

## License

MIT - a24z Team
# themed-markdown

Industry-themed markdown renderer with presentation capabilities.

## Features

- 🎨 Beautiful industry-themed styling
- 📊 Mermaid diagram support
- 🎯 Presentation mode with slide navigation
- 🌓 Dark/light theme support
- 📱 Responsive design
- ⚡ Built with React and TypeScript

## Installation

```bash
npm install themed-markdown
# or
yarn add themed-markdown
# or
bun add themed-markdown
```

## Usage

```tsx
import { IndustryMarkdownSlide } from 'themed-markdown/industryMarkdown';
import { ThemeProvider } from 'themed-markdown/industryTheme';

function App() {
  const markdownContent = `
# My Presentation

## Slide 1
Content for the first slide

## Slide 2
Content for the second slide
  `;

  return (
    <ThemeProvider>
      <IndustryMarkdownSlide 
        markdown={markdownContent}
        slideId="slide-1"
      />
    </ThemeProvider>
  );
}
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build the project
bun run build

# Type check
bun run typecheck

# Lint
bun run lint
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

Developed by [a24z.ai](https://a24z.ai)
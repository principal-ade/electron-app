# Alexandria Outpost

A local UI for browsing Alexandria repository documentation. Run Alexandria locally and connect to either the remote registry or your own local repository registry.

## Installation

```bash
npm install -g @a24z/alexandria-outpost
```

Or use directly with npx:

```bash
npx @a24z/alexandria-outpost serve
```

## Usage

### Basic Usage

Start the Alexandria UI locally:

```bash
alexandria-outpost serve
```

This will:
- Start a local server on port 3003
- Open your browser automatically
- Connect to the default Alexandria API at https://git-gallery.com

### Command Options

```bash
alexandria-outpost serve [options]

Options:
  -p, --port <port>     Port to run the server on (default: 3003)
  --api-url <url>       Alexandria API URL (default: https://git-gallery.com)
  --no-open            Do not open browser automatically
  -h, --help           Display help
```

### Examples

Run on a different port:
```bash
alexandria-outpost serve --port 8080
```

Connect to a local API server:
```bash
alexandria-outpost serve --api-url http://localhost:3002
```

Run without opening browser:
```bash
alexandria-outpost serve --no-open
```

## Integration with Memory Palace

Alexandria Outpost is designed to work seamlessly with the Memory Palace CLI. When Memory Palace implements local registry support, you'll be able to:

```bash
# Future Memory Palace integration
memory-palace alexandria serve
memory-palace alexandria scan ./repos
memory-palace alexandria add /path/to/repo
```

## Environment Variables

You can also configure the outpost using environment variables:

```bash
PORT=8080 ALEXANDRIA_API_URL=http://localhost:3002 alexandria-outpost serve
```

## Development

To build from source:

```bash
git clone https://github.com/a24z-ai/alexandria.git
cd alexandria
npm install
npm run build:ui -- --config astro.config.outpost.mjs
node scripts/build-server.js
node dist/cli.js serve
```

## License

MIT © a24z

## Links

- [Alexandria Repository](https://github.com/a24z-ai/alexandria)
- [Memory Palace](https://github.com/a24z-ai/memory-palace)
- [a24z Memory](https://github.com/a24z-ai/a24z-memory)
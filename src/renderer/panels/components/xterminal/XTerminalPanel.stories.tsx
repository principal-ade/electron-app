import type { Meta, StoryObj } from '@storybook/react';
import { useRef, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ThemeProvider } from '@a24z/industry-theme';
import { XTerminalPanel } from './index';
import type { XTerminalPanelRef } from './types';

const meta = {
  title: 'Components/XTerminalPanel',
  component: XTerminalPanel,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  argTypes: {
    onData: { action: 'data' },
    onResize: { action: 'resize' },
    onLinkClick: { action: 'link-click' },
    onClose: { action: 'close' },
    onDestroy: { action: 'destroy' },
    onPopOut: { action: 'pop-out' },
  },
} satisfies Meta<typeof XTerminalPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic terminal with welcome message
 */
export const Basic: Story = {
  args: {
    headerTitle: 'Terminal',
    headerSubtitle: '/home/user/project',
    autoFocus: true,
    onData: (data) => console.log('User typed:', data),
    onResize: (cols, rows) => console.log('Terminal resized:', cols, rows),
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('Welcome to XTerminalPanel!\r\n');
        terminalRef.current.write(
          'This is a pure UI component for testing.\r\n\r\n',
        );
        terminalRef.current.write('$ ');
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with simulated output
 */
export const WithOutput: Story = {
  args: {
    headerTitle: 'Terminal',
    headerSubtitle: '/home/user/project',
    onData: (data) => console.log('User typed:', data),
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        const lines = [
          '$ npm install\r\n',
          '\x1b[32m✓\x1b[0m Installed 245 packages in 3.2s\r\n\r\n',
          '$ npm run build\r\n',
          '\x1b[36mBuilding for production...\x1b[0m\r\n',
          '  - Compiling TypeScript... \x1b[32mdone\x1b[0m\r\n',
          '  - Bundling assets... \x1b[32mdone\x1b[0m\r\n',
          '  - Optimizing... \x1b[32mdone\x1b[0m\r\n\r\n',
          '\x1b[32m✓\x1b[0m Build completed successfully!\r\n',
          '\x1b[90mOutput: dist/\x1b[0m\r\n\r\n',
          '$ ',
        ];

        let index = 0;
        const interval = setInterval(() => {
          if (index < lines.length && terminalRef.current) {
            terminalRef.current.write(lines[index]);
            index++;
          } else {
            clearInterval(interval);
          }
        }, 200);

        return () => clearInterval(interval);
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with colored output and ANSI codes
 */
export const ColoredOutput: Story = {
  args: {
    headerTitle: 'Terminal',
    headerSubtitle: '/home/user/project',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write(
          '\x1b[1;31mError:\x1b[0m Something went wrong\r\n',
        );
        terminalRef.current.write(
          '\x1b[1;33mWarning:\x1b[0m This is deprecated\r\n',
        );
        terminalRef.current.write(
          '\x1b[1;32mSuccess:\x1b[0m Build completed\r\n',
        );
        terminalRef.current.write(
          '\x1b[1;34mInfo:\x1b[0m Starting server...\r\n',
        );
        terminalRef.current.write('\x1b[1;35mDebug:\x1b[0m Loaded config\r\n');
        terminalRef.current.write(
          '\x1b[1;36mLog:\x1b[0m Server listening on port 3000\r\n\r\n',
        );
        terminalRef.current.write(
          'Links: \x1b]8;;http://localhost:3000\x1b\\http://localhost:3000\x1b]8;;\x1b\\\r\n',
        );
        terminalRef.current.write('$ ');
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with a badge in the header
 */
export const WithBadge: Story = {
  args: {
    headerTitle: 'Terminal',
    headerSubtitle: '/home/user/project',
    headerBadge: {
      label: 'AI: Session-123',
      color: '#00D9FF',
    },
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('Terminal with AI session badge\r\n$ ');
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal without header
 */
export const NoHeader: Story = {
  args: {
    hideHeader: true,
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('Terminal without header\r\n$ ');
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with all action buttons
 */
export const WithAllActions: Story = {
  args: {
    headerTitle: 'Terminal',
    headerSubtitle: '/home/user/project',
    onClose: () => console.log('Close clicked'),
    onDestroy: () => console.log('Destroy clicked'),
    onPopOut: () => console.log('Pop-out clicked'),
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write(
          'Terminal with all actions (close, destroy, pop-out)\r\n$ ',
        );
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with ownership overlay
 */
export const OwnershipOverlay: Story = {
  args: {
    headerTitle: 'Terminal',
    headerSubtitle: '/home/user/project',
    overlayState: {
      type: 'owned',
      message: 'This terminal is active in another window',
      subtitle: 'Window ID: 42',
      actions: [
        {
          label: 'Switch to Window',
          onClick: () => console.log('Switch to window'),
          primary: true,
          icon: <ArrowRight size={16} />,
        },
        {
          label: 'Take Control Here',
          onClick: () => console.log('Take control'),
          primary: false,
        },
      ],
    },
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <XTerminalPanel {...args} />
    </div>
  ),
};

/**
 * Terminal with loading overlay
 */
export const LoadingOverlay: Story = {
  args: {
    headerTitle: 'Terminal',
    headerSubtitle: '/home/user/project',
    overlayState: {
      type: 'loading',
      message: 'Connecting to terminal session...',
      subtitle: 'Please wait',
    },
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <XTerminalPanel {...args} />
    </div>
  ),
};

/**
 * Terminal with error overlay
 */
export const ErrorOverlay: Story = {
  args: {
    headerTitle: 'Terminal',
    headerSubtitle: '/home/user/project',
    overlayState: {
      type: 'error',
      message: 'Failed to connect to terminal session',
      subtitle: 'Session ID not found',
      actions: [
        {
          label: 'Retry',
          onClick: () => console.log('Retry'),
          primary: true,
        },
        {
          label: 'Close',
          onClick: () => console.log('Close'),
          primary: false,
        },
      ],
    },
  },
  render: (args) => (
    <div style={{ height: '600px', width: '100%' }}>
      <XTerminalPanel {...args} />
    </div>
  ),
};

/**
 * Interactive terminal with simulated backend
 */
export const Interactive: Story = {
  args: {
    headerTitle: 'Interactive Terminal',
    headerSubtitle: '/home/user/project',
    onClose: () => console.log('Close clicked'),
    onDestroy: () => console.log('Destroy clicked'),
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);
    const commandBufferRef = useRef('');

    const handleData = (data: string) => {
      if (!terminalRef.current) return;

      // Handle special keys
      if (data === '\r') {
        // Enter key
        const command = commandBufferRef.current.trim();
        terminalRef.current.write('\r\n');

        // Simulate command execution
        if (command === 'help') {
          terminalRef.current.write('Available commands:\r\n');
          terminalRef.current.write('  help   - Show this help\r\n');
          terminalRef.current.write('  clear  - Clear the screen\r\n');
          terminalRef.current.write('  date   - Show current date\r\n');
          terminalRef.current.write('  echo   - Echo text\r\n');
        } else if (command === 'clear') {
          terminalRef.current.clear();
        } else if (command === 'date') {
          terminalRef.current.write(new Date().toString() + '\r\n');
        } else if (command.startsWith('echo ')) {
          terminalRef.current.write(command.substring(5) + '\r\n');
        } else if (command !== '') {
          terminalRef.current.write(`Command not found: ${command}\r\n`);
          terminalRef.current.write('Type "help" for available commands\r\n');
        }

        terminalRef.current.write('$ ');
        commandBufferRef.current = '';
      } else if (data === '\x7F') {
        // Backspace
        if (commandBufferRef.current.length > 0) {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
          terminalRef.current.write('\b \b');
        }
      } else if (data >= String.fromCharCode(0x20)) {
        // Printable characters
        commandBufferRef.current += data;
        terminalRef.current.write(data);
      }
    };

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('Welcome to the interactive terminal!\r\n');
        terminalRef.current.write(
          'Type "help" for available commands.\r\n\r\n',
        );
        terminalRef.current.write('$ ');
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} onData={handleData} />
      </div>
    );
  },
};

/**
 * Terminal with link handling
 */
export const WithLinks: Story = {
  args: {
    headerTitle: 'Terminal',
    headerSubtitle: '/home/user/project',
    onLinkClick: (url, isLocalhost) => {
      alert(`Link clicked: ${url}\nIs localhost: ${isLocalhost}`);
    },
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('Terminal with clickable links:\r\n\r\n');
        terminalRef.current.write('Localhost: http://localhost:3000\r\n');
        terminalRef.current.write('External: https://github.com\r\n\r\n');
        terminalRef.current.write('Click the links to test the handler!\r\n$ ');
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Small terminal for compact spaces
 */
export const Small: Story = {
  args: {
    headerTitle: 'Small Terminal',
    hideHeader: false,
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('$ npm start\r\n');
        terminalRef.current.write('Server running on port 3000\r\n$ ');
      }
    }, []);

    return (
      <div style={{ height: '300px', width: '400px' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with long build output
 * Tests scrolling and performance with ~500 lines
 */
export const LongBuildOutput: Story = {
  args: {
    headerTitle: 'Terminal - Long Build Output',
    headerSubtitle: '/home/user/project',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (!terminalRef.current) return;

      terminalRef.current.write('$ npm run build\r\n');
      terminalRef.current.write(
        '\x1b[36mBuilding production bundle...\x1b[0m\r\n\r\n',
      );

      // Write in chunks to avoid blocking UI
      let i = 1;
      const chunkSize = 50;

      const writeChunk = () => {
        if (!terminalRef.current) return;

        const end = Math.min(i + chunkSize, 501);
        let chunk = '';

        for (; i < end; i++) {
          const color = i % 10 === 0 ? '\x1b[32m' : '\x1b[90m';
          const reset = '\x1b[0m';
          const status = i % 50 === 0 ? '✓' : '→';

          chunk += `${color}${status} [${i}/500] Compiling module-${i}.ts${reset}\r\n`;
        }

        terminalRef.current.write(chunk);

        if (i < 501) {
          requestAnimationFrame(writeChunk);
        } else {
          terminalRef.current.write(
            '\r\n\x1b[32m✓\x1b[0m Build completed successfully!\r\n',
          );
          terminalRef.current.write('\x1b[90mTotal time: 12.3s\x1b[0m\r\n');
          terminalRef.current.write('$ ');
        }
      };

      // Start writing after a small delay to ensure terminal is ready
      setTimeout(writeChunk, 100);
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with streaming logs
 * Simulates continuous log output
 */
export const StreamingLogs: Story = {
  args: {
    headerTitle: 'Terminal - Streaming Logs',
    headerSubtitle: '/var/log/app',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('$ tail -f application.log\r\n');

        const logLevels = [
          { prefix: 'INFO', color: '\x1b[36m' },
          { prefix: 'WARN', color: '\x1b[33m' },
          { prefix: 'ERROR', color: '\x1b[31m' },
          { prefix: 'DEBUG', color: '\x1b[90m' },
        ];

        const messages = [
          'Request received from 192.168.1.100',
          'Processing authentication',
          'Database query executed in 45ms',
          'Cache hit for key: user_session_123',
          'Response sent with status 200',
          'Memory usage: 512MB / 2GB',
          'Active connections: 42',
          'Background job completed',
        ];

        let lineCount = 0;
        const interval = setInterval(() => {
          if (terminalRef.current && lineCount < 200) {
            const level =
              logLevels[Math.floor(Math.random() * logLevels.length)];
            const message =
              messages[Math.floor(Math.random() * messages.length)];
            const timestamp = new Date().toISOString();

            terminalRef.current.write(
              `${level.color}[${level.prefix}]\x1b[0m \x1b[90m${timestamp}\x1b[0m ${message}\r\n`,
            );
            lineCount++;
          } else {
            clearInterval(interval);
          }
        }, 50);

        return () => clearInterval(interval);
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with very long output (exceeds scrollback buffer)
 * Tests buffer limits with 15,000 lines (scrollback is 10,000)
 */
export const ExtremelyLongOutput: Story = {
  args: {
    headerTitle: 'Terminal - Extreme Output (15k lines)',
    headerSubtitle: '/home/user/project',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (!terminalRef.current) return;

      terminalRef.current.write('$ cat huge-log-file.txt\r\n');
      terminalRef.current.write(
        '\x1b[33mWarning: This will exceed the scrollback buffer (10,000 lines)\x1b[0m\r\n',
      );
      terminalRef.current.write(
        '\x1b[33mWriting 15,000 lines in chunks...\x1b[0m\r\n\r\n',
      );

      // Write in chunks to avoid blocking UI
      let i = 1;
      const chunkSize = 100;

      const writeChunk = () => {
        if (!terminalRef.current) return;

        const end = Math.min(i + chunkSize, 15001);
        let chunk = '';

        for (; i < end; i++) {
          if (i % 1000 === 0) {
            chunk += `\r\n\x1b[1;36m=== Milestone: Line ${i} ===\x1b[0m\r\n\r\n`;
          }

          const lineNum = i.toString().padStart(5, '0');
          chunk += `${lineNum}: Lorem ipsum dolor sit amet, consectetur adipiscing elit\r\n`;
        }

        terminalRef.current.write(chunk);

        if (i < 15001) {
          requestAnimationFrame(writeChunk);
        } else {
          terminalRef.current.write(
            '\r\n\x1b[32m✓\x1b[0m EOF - First ~5,000 lines should be gone from buffer\r\n',
          );
          terminalRef.current.write(
            '\x1b[90mScroll up to verify buffer limit!\x1b[0m\r\n',
          );
          terminalRef.current.write('$ ');
        }
      };

      // Start writing after a small delay
      setTimeout(writeChunk, 100);
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with npm install output
 * Realistic long output with progress indicators
 */
export const NpmInstall: Story = {
  args: {
    headerTitle: 'Terminal - npm install',
    headerSubtitle: '/home/user/my-app',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('$ npm install\r\n');

        const packages = [
          'react',
          'react-dom',
          '@types/react',
          '@types/react-dom',
          'typescript',
          'webpack',
          'webpack-cli',
          'babel-loader',
          '@babel/core',
          '@babel/preset-react',
          '@babel/preset-typescript',
          'eslint',
          'prettier',
          'jest',
          '@testing-library/react',
          'axios',
          'lodash',
          'moment',
          'uuid',
          'chalk',
          'express',
          'cors',
          'body-parser',
          'mongoose',
          'dotenv',
          'socket.io',
          'socket.io-client',
          'redis',
          'jsonwebtoken',
          'bcrypt',
          'multer',
          'helmet',
          'compression',
          'morgan',
        ];

        // Downloading phase
        terminalRef.current.write(
          '\r\n\x1b[90mnpm\x1b[0m \x1b[36minfo\x1b[0m using npm@10.2.0\r\n',
        );
        terminalRef.current.write(
          '\x1b[90mnpm\x1b[0m \x1b[36minfo\x1b[0m using node@v20.9.0\r\n\r\n',
        );

        let count = 0;
        const interval = setInterval(() => {
          if (terminalRef.current && count < packages.length) {
            const pkg = packages[count];
            const version = `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 10)}`;

            terminalRef.current.write(
              `\x1b[90mnpm\x1b[0m \x1b[36mhttp\x1b[0m fetch GET 200 https://registry.npmjs.org/${pkg} 123ms\r\n`,
            );

            if (count % 3 === 0) {
              terminalRef.current.write(
                `\x1b[90mnpm\x1b[0m \x1b[36minfo\x1b[0m ${pkg}@${version} installed\r\n`,
              );
            }

            count++;

            if (count === packages.length) {
              clearInterval(interval);
              terminalRef.current?.write('\r\n');
              terminalRef.current?.write(
                'added 245 packages, and audited 246 packages in 8s\r\n\r\n',
              );
              terminalRef.current?.write(
                '42 packages are looking for funding\r\n',
              );
              terminalRef.current?.write(
                '  run `npm fund` for details\r\n\r\n',
              );
              terminalRef.current?.write(
                '\x1b[32mfound 0 vulnerabilities\x1b[0m\r\n$ ',
              );
            }
          }
        }, 100);

        return () => clearInterval(interval);
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with very wide lines
 * Tests horizontal scrolling and line wrapping with 500+ character lines
 */
export const VeryWideLines: Story = {
  args: {
    headerTitle: 'Terminal - Wide Lines',
    headerSubtitle: '/home/user/project',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        // Add a small delay to ensure terminal is fully initialized
        setTimeout(() => {
          if (!terminalRef.current) return;

          terminalRef.current.write('$ cat extremely-long-log.txt\r\n\r\n');

          // Very long single-line log entry
          const longPath =
            '/very/deep/nested/folder/structure/that/goes/on/forever/and/ever/until/it/becomes/ridiculously/long/to/test/horizontal/scrolling/behavior';
          terminalRef.current.write(
            `\x1b[33m[WARN]\x1b[0m File path too long: ${longPath}/file1.txt ${longPath}/file2.txt ${longPath}/file3.txt\r\n\r\n`,
          );

          // Very long error message
          terminalRef.current.write(
            '\x1b[31m[ERROR]\x1b[0m Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\r\n\r\n',
          );

          // Very long JSON-like output
          terminalRef.current.write(
            '{\x1b[36m"user"\x1b[0m: {\x1b[36m"id"\x1b[0m: 12345, \x1b[36m"name"\x1b[0m: "John Doe", \x1b[36m"email"\x1b[0m: "john.doe@example.com", \x1b[36m"address"\x1b[0m: "123 Very Long Street Name That Goes On Forever Boulevard, Apartment 456, Building C, Complex Name, City, State, Country, Postal Code 12345-6789", \x1b[36m"preferences"\x1b[0m: {"theme": "dark", "language": "en", "notifications": true, "privacy": {"shareData": false, "analytics": false}}}}\r\n\r\n',
          );

          // Very long command output
          terminalRef.current.write(
            '$ ls -la /usr/local/include/node/openssl/archs/linux-x86_64/asm_avx2/crypto/buildinf.h /usr/local/include/node/openssl/archs/linux-x86_64/asm_avx2/include/openssl/opensslconf.h\r\n',
          );
          terminalRef.current.write(
            '-rw-r--r--  1 root root 1234 Jan 1 12:00 /usr/local/include/node/openssl/archs/linux-x86_64/asm_avx2/crypto/buildinf.h -> /extremely/long/symlink/target/path/that/wraps/around/the/terminal/screen/multiple/times/just/to/see/what/happens\r\n\r\n',
          );

          // Very long stack trace
          terminalRef.current.write(
            "\x1b[31mError: Cannot find module './some/very/deeply/nested/module/that/is/located/in/a/folder/structure/so/deep/it/becomes/absolutely/ridiculous/and/probably/violates/some/filesystem/limits'\x1b[0m\r\n",
          );
          terminalRef.current.write(
            '    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1048:15) at /home/user/project/node_modules/some-package/lib/index.js:123:456 at /home/user/project/node_modules/another-package/lib/very-long-filename-that-describes-exactly-what-this-module-does-in-excruciating-detail.js:789:101\r\n\r\n',
          );

          // Very long URL
          terminalRef.current.write(
            'Fetching: \x1b]8;;https://api.example.com/v1/users/12345/profile/settings/preferences/notifications/email/digest/weekly/summary?include=metadata&fields=id,name,email,created_at,updated_at,preferences,settings&filter=active&sort=name&order=asc&limit=100&offset=0&api_key=sk_test_1234567890abcdefghijklmnopqrstuvwxyz\x1b\\https://api.example.com/v1/users/12345/profile/settings/preferences/notifications/email/digest/weekly/summary?include=metadata&fields=id,name,email,created_at,updated_at,preferences,settings&filter=active&sort=name&order=asc&limit=100&offset=0&api_key=sk_test_1234567890abcdefghijklmnopqrstuvwxyz\x1b]8;;\x1b\\\r\n\r\n',
          );

          // Very long repeated character line
          const longLine = '='.repeat(500);
          terminalRef.current.write(`\x1b[90m${longLine}\x1b[0m\r\n\r\n`);

          terminalRef.current.write('$ ');
        }, 100); // 100ms delay to ensure terminal is ready
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with extremely wide table output
 * Tests wrapping behavior with formatted tables
 */
export const WideTableOutput: Story = {
  args: {
    headerTitle: 'Terminal - Wide Table',
    headerSubtitle: '/home/user/project',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('$ docker ps -a --no-trunc\r\n\r\n');

        // Header
        terminalRef.current.write(
          'CONTAINER ID                                                                 IMAGE                                                    COMMAND                                                                                                                              CREATED             STATUS              PORTS               NAMES\r\n',
        );

        // Very wide table rows
        terminalRef.current.write(
          'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd     nginx:latest                                             "/docker-entrypoint.sh nginx -g \'daemon off;\' --with-very-long-config-option --another-long-option --and-another-one"                    2 hours ago         Up 2 hours          0.0.0.0:8080->80/tcp   my-very-long-container-name-that-describes-exactly-what-it-does\r\n',
        );

        terminalRef.current.write(
          '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefabcd     postgres:14-alpine                                       "docker-entrypoint.sh postgres -c config_file=/etc/postgresql/postgresql.conf -c hba_file=/etc/postgresql/pg_hba.conf"                  5 hours ago         Up 5 hours          5432/tcp            database-server-for-production-environment-with-replication\r\n',
        );

        terminalRef.current.write(
          'xyz9876543210xyz9876543210xyz9876543210xyz9876543210xyz9876543210xyz     redis:7.0                                                "redis-server --appendonly yes --requirepass my-super-secret-password-that-should-not-be-in-plain-text-but-here-we-are"                  1 day ago           Up 1 day            6379/tcp            redis-cache-cluster-node-01-production\r\n\r\n',
        );

        terminalRef.current.write('$ ');
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with mixed wide and normal content
 * Tests behavior when switching between wide and normal lines
 */
export const MixedWidthContent: Story = {
  args: {
    headerTitle: 'Terminal - Mixed Width',
    headerSubtitle: '/home/user/project',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('$ npm run build\r\n\r\n');
        terminalRef.current.write('Building application...\r\n');
        terminalRef.current.write('✓ TypeScript compiled\r\n');
        terminalRef.current.write(
          '\x1b[33m⚠ Warning: Bundle size is very large\x1b[0m\r\n',
        );

        // Suddenly a very wide line
        terminalRef.current.write(
          '\x1b[90m→ dist/assets/main-bundle-with-a-very-long-hash-that-represents-the-content-hash-of-this-bundle-1234567890abcdef1234567890abcdef1234567890abcdef.js (2.5 MB) - This bundle contains: React, ReactDOM, Redux, Redux-Saga, Axios, Lodash, Moment, D3, Three.js, and many other dependencies that probably should have been code-split\x1b[0m\r\n',
        );

        terminalRef.current.write('✓ Assets copied\r\n');
        terminalRef.current.write('✓ Service worker generated\r\n');

        // Another wide line
        terminalRef.current.write(
          '\x1b[36mℹ Tip: Consider splitting your bundle using dynamic imports: import(/* webpackChunkName: "my-chunk" */ \'./MyComponent\').then(module => module.default) to reduce the initial bundle size and improve loading performance for your users\x1b[0m\r\n',
        );

        terminalRef.current.write(
          '\r\n\x1b[32m✓ Build completed successfully!\x1b[0m\r\n',
        );
        terminalRef.current.write('$ ');
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

/**
 * Terminal with search functionality demonstration
 * Shows how to use the search addon to find text
 */
export const SearchableTerminal: Story = {
  args: {
    headerTitle: 'Terminal - Search Demo',
    headerSubtitle: 'Press Ctrl+F to search',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchVisible, setSearchVisible] = useState(false);

    useEffect(() => {
      if (terminalRef.current) {
        // Add some content to search through
        setTimeout(() => {
          if (!terminalRef.current) return;

          terminalRef.current.write('$ grep -r "TODO" src/\r\n');
          terminalRef.current.write(
            '\x1b[36msrc/app.ts:42:\x1b[0m    // TODO: Implement user authentication\r\n',
          );
          terminalRef.current.write(
            '\x1b[36msrc/database.ts:15:\x1b[0m  // TODO: Add connection pooling\r\n',
          );
          terminalRef.current.write(
            '\x1b[36msrc/api.ts:78:\x1b[0m      // TODO: Add rate limiting\r\n',
          );
          terminalRef.current.write(
            '\x1b[36msrc/cache.ts:23:\x1b[0m    // TODO: Implement LRU eviction\r\n',
          );
          terminalRef.current.write(
            '\x1b[36msrc/logger.ts:91:\x1b[0m   // TODO: Add log rotation\r\n',
          );
          terminalRef.current.write(
            '\x1b[36msrc/auth.ts:156:\x1b[0m    // TODO: Implement OAuth2\r\n',
          );
          terminalRef.current.write(
            '\x1b[36msrc/mailer.ts:34:\x1b[0m   // TODO: Add email templates\r\n',
          );
          terminalRef.current.write(
            '\x1b[36msrc/worker.ts:67:\x1b[0m   // TODO: Add job retry logic\r\n',
          );
          terminalRef.current.write(
            '\x1b[36msrc/validation.ts:89:\x1b[0m // TODO: Add custom validators\r\n',
          );
          terminalRef.current.write(
            '\x1b[36msrc/middleware.ts:112:\x1b[0m // TODO: Add CORS configuration\r\n\r\n',
          );
          terminalRef.current.write('Found 10 TODOs in the codebase.\r\n\r\n');
          terminalRef.current.write('Try searching for:\r\n');
          terminalRef.current.write('  - "TODO" to find all todos\r\n');
          terminalRef.current.write(
            '  - "auth" to find authentication related items\r\n',
          );
          terminalRef.current.write(
            '  - "src/.*\\.ts" with regex enabled\r\n\r\n',
          );
          terminalRef.current.write(
            'Use the search bar below to search the terminal content.\r\n',
          );
          terminalRef.current.write('$ ');
        }, 100);

        // Add keyboard shortcut handler
        const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            setSearchVisible(true);
          }
          if (e.key === 'Escape') {
            setSearchVisible(false);
            terminalRef.current?.clearSearch();
          }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }
    }, []);

    const handleSearch = (forward: boolean = true) => {
      if (terminalRef.current && searchTerm) {
        const found = forward
          ? terminalRef.current.findNext(searchTerm, { caseSensitive: false })
          : terminalRef.current.findPrevious(searchTerm, {
              caseSensitive: false,
            });

        if (!found) {
          console.log('No matches found');
        }
      }
    };

    return (
      <div
        style={{
          height: '600px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {searchVisible && (
          <div
            style={{
              padding: '10px',
              backgroundColor: '#2a2a2a',
              borderBottom: '1px solid #444',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              placeholder="Search terminal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(!e.shiftKey);
                }
              }}
              style={{
                flex: 1,
                padding: '5px 10px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
              }}
              autoFocus
            />
            <button
              onClick={() => handleSearch(false)}
              style={{
                padding: '5px 15px',
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Previous
            </button>
            <button
              onClick={() => handleSearch(true)}
              style={{
                padding: '5px 15px',
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Next
            </button>
            <button
              onClick={() => {
                setSearchVisible(false);
                terminalRef.current?.clearSearch();
              }}
              style={{
                padding: '5px 15px',
                backgroundColor: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}
        <div style={{ flex: 1 }}>
          <XTerminalPanel ref={terminalRef} {...args} />
        </div>
        {!searchVisible && (
          <div
            style={{
              padding: '10px',
              backgroundColor: '#2a2a2a',
              borderTop: '1px solid #444',
              textAlign: 'center',
              color: '#888',
            }}
          >
            Press Ctrl+F (or Cmd+F on Mac) to open search
          </div>
        )}
      </div>
    );
  },
};

/**
 * Terminal with different scrollbar styles
 * Shows the various scrollbar options available
 */
export const ScrollbarStyles: Story = {
  args: {
    headerTitle: 'Terminal - Scrollbar Styles',
    headerSubtitle: 'Choose your preferred style',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);
    const [scrollStyle, setScrollStyle] = useState<
      'overlay' | 'thin' | 'hidden' | 'auto-hide'
    >('overlay');

    useEffect(() => {
      if (terminalRef.current) {
        // Add content that requires scrolling
        setTimeout(() => {
          if (!terminalRef.current) return;

          terminalRef.current.write('Scrollbar Style Demo\r\n');
          terminalRef.current.write('====================\r\n\r\n');

          // Generate enough content to require scrolling
          for (let i = 1; i <= 100; i++) {
            const color = i % 10 === 0 ? '\x1b[32m' : '\x1b[90m';
            terminalRef.current.write(
              `${color}Line ${i}: This is some sample output to demonstrate scrollbar behavior\x1b[0m\r\n`,
            );
          }

          terminalRef.current.write(
            '\r\n\x1b[33mScroll up and down to see the scrollbar behavior!\x1b[0m\r\n',
          );
          terminalRef.current.write(
            'Try different styles using the buttons above.\r\n\r\n',
          );

          terminalRef.current.write('Scrollbar Styles:\r\n');
          terminalRef.current.write(
            "• \x1b[36mOverlay\x1b[0m - Scrollbar overlays content (doesn't take space)\r\n",
          );
          terminalRef.current.write(
            '• \x1b[36mThin\x1b[0m - Ultra-thin 4px scrollbar\r\n',
          );
          terminalRef.current.write(
            '• \x1b[36mHidden\x1b[0m - No visible scrollbar (scroll still works)\r\n',
          );
          terminalRef.current.write(
            '• \x1b[36mAuto-hide\x1b[0m - Shows on hover only\r\n\r\n',
          );
          terminalRef.current.write('$ ');
        }, 100);
      }
    }, [scrollStyle]); // Re-render when style changes

    const styles = [
      {
        value: 'overlay' as const,
        label: 'Overlay (Default)',
        description: 'Semi-transparent, overlays content',
      },
      {
        value: 'thin' as const,
        label: 'Thin',
        description: 'Ultra-thin 4px scrollbar',
      },
      {
        value: 'hidden' as const,
        label: 'Hidden',
        description: 'No scrollbar visible',
      },
      {
        value: 'auto-hide' as const,
        label: 'Auto-hide',
        description: 'Shows on hover',
      },
    ];

    return (
      <div
        style={{
          height: '600px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px',
            backgroundColor: '#2a2a2a',
            borderBottom: '1px solid #444',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#fff', fontSize: '14px' }}>
            Choose scrollbar style:
          </span>
          {styles.map((style) => (
            <button
              key={style.value}
              onClick={() => setScrollStyle(style.value)}
              style={{
                padding: '8px 16px',
                backgroundColor:
                  scrollStyle === style.value ? '#0066cc' : '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '2px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (scrollStyle !== style.value) {
                  e.currentTarget.style.backgroundColor = '#555';
                }
              }}
              onMouseLeave={(e) => {
                if (scrollStyle !== style.value) {
                  e.currentTarget.style.backgroundColor = '#444';
                }
              }}
            >
              <div>{style.label}</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                {style.description}
              </div>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <XTerminalPanel
            ref={terminalRef}
            {...args}
            scrollbarStyle={scrollStyle}
            key={scrollStyle} // Force re-render on style change
          />
        </div>
        <div
          style={{
            padding: '10px',
            backgroundColor: '#2a2a2a',
            borderTop: '1px solid #444',
            color: '#888',
            fontSize: '12px',
            textAlign: 'center',
          }}
        >
          Current style:{' '}
          <strong style={{ color: '#fff' }}>{scrollStyle}</strong> |
          {scrollStyle === 'auto-hide'
            ? ' Hover over the terminal to see the scrollbar'
            : ' Scroll to see the scrollbar behavior'}
        </div>
      </div>
    );
  },
};

/**
 * Terminal with test suite output
 * Colorful output with pass/fail indicators
 */
export const TestSuiteOutput: Story = {
  args: {
    headerTitle: 'Terminal - Test Suite',
    headerSubtitle: '/home/user/project',
  },
  render: (args) => {
    const terminalRef = useRef<XTerminalPanelRef>(null);

    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.write('$ npm test\r\n\r\n');
        terminalRef.current.write('\x1b[1mJest Test Runner\x1b[0m\r\n');
        terminalRef.current.write(
          '\x1b[90mFound 45 test suites\x1b[0m\r\n\r\n',
        );

        const testFiles = [
          'auth.test.ts',
          'user.test.ts',
          'api.test.ts',
          'database.test.ts',
          'middleware.test.ts',
          'utils.test.ts',
          'validation.test.ts',
          'components/Button.test.tsx',
          'components/Input.test.tsx',
          'components/Modal.test.tsx',
          'hooks/useAuth.test.ts',
          'hooks/useData.test.ts',
          'services/api.test.ts',
        ];

        let fileIndex = 0;
        const interval = setInterval(() => {
          if (terminalRef.current && fileIndex < testFiles.length) {
            const file = testFiles[fileIndex];
            const numTests = Math.floor(Math.random() * 8) + 3;
            const shouldFail = Math.random() > 0.85; // 15% chance of failure

            terminalRef.current.write(`\x1b[1m${file}\x1b[0m\r\n`);

            for (let i = 0; i < numTests; i++) {
              const testName = `test case ${i + 1}`;
              const isFail = shouldFail && i === numTests - 1;

              if (isFail) {
                terminalRef.current.write(
                  `  \x1b[31m✕\x1b[0m ${testName} (${Math.floor(Math.random() * 200)}ms)\r\n`,
                );
                terminalRef.current.write(
                  `    \x1b[31mError: Expected true to be false\x1b[0m\r\n`,
                );
              } else {
                terminalRef.current.write(
                  `  \x1b[32m✓\x1b[0m ${testName} (${Math.floor(Math.random() * 100)}ms)\r\n`,
                );
              }
            }

            terminalRef.current.write('\r\n');
            fileIndex++;

            if (fileIndex === testFiles.length) {
              clearInterval(interval);
              const total = testFiles.length * 5;
              const passed = total - 2;
              terminalRef.current?.write(
                '\x1b[1mTest Suites: \x1b[0m\x1b[32m11 passed\x1b[0m, \x1b[31m2 failed\x1b[0m, 13 total\r\n',
              );
              terminalRef.current?.write(
                `\x1b[1mTests:       \x1b[0m\x1b[32m${passed} passed\x1b[0m, \x1b[31m2 failed\x1b[0m, ${total} total\r\n`,
              );
              terminalRef.current?.write(
                '\x1b[1mTime:        \x1b[0m4.521s\r\n$ ',
              );
            }
          }
        }, 150);

        return () => clearInterval(interval);
      }
    }, []);

    return (
      <div style={{ height: '600px', width: '100%' }}>
        <XTerminalPanel ref={terminalRef} {...args} />
      </div>
    );
  },
};

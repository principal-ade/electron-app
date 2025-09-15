/**
 * @fileoverview Core Library
 *
 * This library provides specialized modules for PrincipleMD projects.
 * There is no main export - import directly from the specific module you need.
 *
 * Available modules:
 *
 * @module core/hooks - Agent event tracking and monitoring
 * @example
 * ```typescript
 * import { AgentHook, EventProcessor } from 'core/hooks';
 *
 * const hook = new AgentHook();
 * ```
 *
 * @module core/mcp - Model Context Protocol (MCP) server implementation
 * @example
 * ```typescript
 * import { McpServer, BaseTool } from 'core/mcp';
 *
 * const server = new McpServer(config);
 * ```
 *
 * @module core/node-framework - Flow-based programming framework
 * @example
 * ```typescript
 * import { Node, Flow, AsyncNode } from 'core/node-framework';
 *
 * class MyNode extends Node {
 *   // Implementation
 * }
 * ```
 *
 * @module core/configs - Configuration loading system with adapters
 * @example
 * ```typescript
 * import { ConfigLoader, LocalConfigAdapter } from 'core/configs';
 *
 * const loader = new ConfigLoader({
 *   adapter: new LocalConfigAdapter()
 * });
 * const config = await loader.loadScanFilters();
 * ```
 *
 * @module @principal-ai/codebase-composition - Layer system for code analysis (moved to npm package)
 * @example
 * ```typescript
 * import { PackageLayerModule, FileTypeLayerModule } from '@principal-ai/codebase-composition';
 *
 * const packages = await packageModule.discoverPackages(fileTree);
 * ```
 *
 * @module core/industryTheme - Theme UI spec-compliant theme system
 * @example
 * ```typescript
 * import { Theme, ThemeProvider, useTheme } from 'core/industryTheme';
 *
 * <ThemeProvider theme={theme}>
 *   <App />
 * </ThemeProvider>
 * ```
 *
 * @module core/industryMarkdown - Industry-themed markdown rendering components
 * @example
 * ```typescript
 * import { IndustryMarkdownSlide, SlidePresentation } from 'core/industryMarkdown';
 *
 * <IndustryMarkdownSlide
 *   content={markdownContent}
 *   slideIdPrefix="slide"
 *   slideIndex={0}
 * />
 * ```
 *
 * @module core/layout-components - Resizable layout components
 * @example
 * ```typescript
 * import { AnimatedResizableLayout } from 'core/layout-components';
 *
 * <AnimatedResizableLayout
 *   leftPanel={<LeftContent />}
 *   rightPanel={<RightContent />}
 *   defaultSize={30}
 * />
 * ```
 */
export {};
//# sourceMappingURL=index.d.ts.map
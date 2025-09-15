/**
 * MCP Server
 * Main server class that manages tools and resources
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { GetCurrentSlideTool, NavigateToSlideTool, UpdateSlideTool, CreateSlideTool, StartPlanningTool, } from '../planning/tools';
import { 
/*AppInfoTool,*/
UserPromptTool, AgentHandoffTool, } from '../tools';
export class McpServer {
    constructor(config) {
        this.tools = new Map();
        this.resources = new Map();
        this.messageQueue = [];
        this.config = config;
        this.server = new Server({
            name: config.name,
            version: config.version,
        }, {
            capabilities: {
                tools: {},
                resources: {},
            },
        });
        this.setupDefaultTools();
        this.setupDefaultResources();
        this.registerHandlers();
    }
    setupDefaultTools() {
        // Add default tools
        // this.addTool(new AppInfoTool(this.config.name, this.config.version, this.config.version));
        this.addTool(new UserPromptTool());
        // Add planning tools
        this.addTool(new StartPlanningTool());
        this.addTool(new GetCurrentSlideTool());
        this.addTool(new NavigateToSlideTool());
        this.addTool(new UpdateSlideTool());
        this.addTool(new CreateSlideTool());
        // Add agent handoff tool
        this.addTool(new AgentHandoffTool());
    }
    setupDefaultResources() {
        // Add app status resource
        this.addResource({
            uri: 'app://status',
            name: 'Application Status',
            description: 'Current application status and metrics',
            mimeType: 'application/json',
            handler: async () => {
                const status = {
                    status: 'running',
                    messageQueue: this.messageQueue.length,
                    timestamp: Date.now(),
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                };
                return JSON.stringify(status, null, 2);
            },
        });
    }
    registerHandlers() {
        // Handle tools/list request
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            const toolList = [];
            for (const [, tool] of this.tools.entries()) {
                toolList.push({
                    name: tool.name,
                    description: tool.description || '',
                    inputSchema: tool.inputSchema || {},
                });
            }
            return { tools: toolList };
        });
        // Handle tools/call request
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            const tool = this.tools.get(name);
            if (!tool) {
                throw new Error(`Unknown tool: ${name}`);
            }
            const result = await tool.handler(args || {});
            return {
                content: result.content,
            };
        });
        // Handle resources/list request
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            const resourceList = [];
            for (const [, resource] of this.resources.entries()) {
                resourceList.push({
                    uri: resource.uri,
                    name: resource.name,
                    description: resource.description || '',
                    mimeType: resource.mimeType || 'text/plain',
                });
            }
            return { resources: resourceList };
        });
        // Handle resources/read request
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const { uri } = request.params;
            const resource = this.resources.get(uri);
            if (!resource) {
                throw new Error(`Unknown resource: ${uri}`);
            }
            const content = await resource.handler();
            return {
                contents: [
                    {
                        uri: resource.uri,
                        mimeType: resource.mimeType || 'text/plain',
                        text: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
                    },
                ],
            };
        });
    }
    addTool(tool) {
        // Cast to AnyMcpTool for storage - runtime validation is handled by the tool's schema
        this.tools.set(tool.name, tool);
    }
    addResource(resource) {
        this.resources.set(resource.uri, resource);
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error(`✅ ${this.config.name} MCP server started successfully`);
    }
    async stop() {
        // Cleanup if needed
        console.error(`${this.config.name} MCP server stopped`);
    }
}

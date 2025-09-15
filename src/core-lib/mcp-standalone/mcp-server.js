#!/usr/bin/env node
"use strict";

/**
 * PrincipalAI MCP Server - Complete Bundle
 * Generated: 2025-09-13T18:21:01.662Z
 */

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/mcp/index.ts
var index_exports = {};
__export(index_exports, {
  BaseTool: () => BaseTool,
  McpServer: () => McpServer
});
module.exports = __toCommonJS(index_exports);

// src/constants/branding.ts
var BRANDING = {
  // Company/Product Names
  COMPANY_NAME: "A24Z",
  PRODUCT_NAME: "specktor.ai",
  APP_NAME: "Specktor",
  // MCP Server
  MCP_SERVER_NAME: "principal-ai-mcp-server",
  MCP_SERVER_CONFIG_KEY: "principal-ai",
  MCP_SERVER_FILENAME: "principal-ai-mcp-server.cjs",
  MCP_SERVER_BUNDLE_NAME: "principal-ai-mcp-server.js",
  // Directories
  MCP_FALLBACK_DIR: ".a24z-mcp",
  // Version Flags
  VERSION_FLAG: "--principal-ai-version",
  // Error Messages
  APP_NOT_RUNNING_ERROR: "The principal.ai application isnt open",
  MCP_BRIDGE_ERROR: "Unable to connect to MCP bridge. Please ensure the PrincipalAI app is running.",
  SCAFFOLD_ERROR: "No scaffold layers found. Generate architectural analysis first using the PrincipalAI app.",
  EXCALIDRAW_ERROR: "Retrieving Excalidraw drawings requires the PrincipalAI app to be running.",
  SEMANTIC_SEARCH_ERROR: "Semantic file search requires the PrincipalAI app to be running with architectural scaffold layers generated.",
  // Versions
  APP_VERSION: "1.0.2",
  MCP_VERSION: "1.0.0",
  // Bridge Ports
  BRIDGE_PORTS: {
    AGENT_SESSION_EVENTS: 3043,
    // Port for claude-hook, gemini-hook, opencode-hook
    PLANNING_MCP: 3045
    // Port for planning document operations
  }
};

// src/mcp/server/McpServer.ts
var import_server = require("@modelcontextprotocol/sdk/server/index.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_types = require("@modelcontextprotocol/sdk/types.js");

// src/mcp/planning/tools/GetCurrentSlideTool.ts
var import_zod2 = require("zod");

// src/mcp/planning/tools/PlanningBaseTool.ts
var http = __toESM(require("http"));

// src/mcp/tools/base-tool.ts
var import_zod = require("zod");

// src/mcp/utils/zod-to-json-schema.ts
function getDescription(def) {
  if (def && typeof def === "object" && "description" in def) {
    const desc = def.description;
    return typeof desc === "string" ? desc : void 0;
  }
  return void 0;
}
function zodToJsonSchema(schema) {
  const rawDef = schema._def;
  if (!rawDef) {
    return { type: "object" };
  }
  const def = rawDef;
  const description = getDescription(def);
  const typeName = String(def.typeName);
  switch (typeName) {
    case "ZodString": {
      return {
        type: "string",
        ...description ? { description } : {}
      };
    }
    case "ZodNumber": {
      return {
        type: "number",
        ...description ? { description } : {}
      };
    }
    case "ZodBoolean": {
      return {
        type: "boolean",
        ...description ? { description } : {}
      };
    }
    case "ZodArray": {
      const itemType = def.type;
      return {
        type: "array",
        items: itemType ? zodToJsonSchema(itemType) : {},
        ...description ? { description } : {}
      };
    }
    case "ZodObject": {
      const properties = {};
      const required = [];
      const shapeFn = def.shape;
      const shape = typeof shapeFn === "function" ? shapeFn() : {};
      for (const [key, fieldSchema] of Object.entries(shape)) {
        const zodField = fieldSchema;
        properties[key] = zodToJsonSchema(zodField);
        const fieldDefUnknown = zodField._def;
        const fieldTypeName = String(fieldDefUnknown == null ? void 0 : fieldDefUnknown.typeName);
        if (fieldTypeName !== "ZodOptional" && fieldTypeName !== "ZodDefault") {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        ...required.length > 0 ? { required } : {},
        ...description ? { description } : {}
      };
    }
    case "ZodOptional": {
      const innerType = def.innerType;
      return innerType ? zodToJsonSchema(innerType) : {};
    }
    case "ZodDefault": {
      const innerType = def.innerType;
      const defaultValueFn = def.defaultValue;
      const innerSchema = innerType ? zodToJsonSchema(innerType) : {};
      return {
        ...innerSchema,
        ...typeof defaultValueFn === "function" ? { default: defaultValueFn() } : {}
      };
    }
    case "ZodEnum": {
      const values = def.values;
      return {
        type: "string",
        ...Array.isArray(values) ? { enum: values } : {},
        ...description ? { description } : {}
      };
    }
    case "ZodUnion": {
      const options = def.options;
      return {
        oneOf: options ? options.map((opt) => zodToJsonSchema(opt)) : [],
        ...description ? { description } : {}
      };
    }
    case "ZodRecord": {
      return {
        type: "object",
        additionalProperties: true,
        ...description ? { description } : {}
      };
    }
    default: {
      return { type: "object" };
    }
  }
}

// src/mcp/tools/base-tool.ts
var BaseTool = class {
  get inputSchema() {
    return zodToJsonSchema(this.schema);
  }
  async handler(params) {
    try {
      const validatedParams = this.schema.parse(params);
      return await this.execute(validatedParams);
    } catch (error) {
      if (error instanceof import_zod.z.ZodError) {
        return {
          content: [
            {
              type: "text",
              text: `Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
            }
          ],
          isError: true
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          }
        ],
        isError: true
      };
    }
  }
  createSuccessResponse(text, data) {
    return {
      content: [
        {
          type: "text",
          text,
          data
        }
      ]
    };
  }
  createErrorResponse(message) {
    return {
      content: [
        {
          type: "text",
          text: message
        }
      ],
      isError: true
    };
  }
};

// src/mcp/planning/tools/PlanningBaseTool.ts
var PlanningBaseTool = class extends BaseTool {
  async makeRequest(path, data) {
    return new Promise((resolve, reject) => {
      const bridgeHost = process.env.PLANNING_BRIDGE_HOST || "localhost";
      const bridgePort = parseInt(process.env.PLANNING_BRIDGE_PORT || "3045");
      const postData = JSON.stringify(data);
      const options = {
        hostname: bridgeHost,
        port: bridgePort,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: 5e3
      };
      const req = http.request(options, (res) => {
        let responseData = "";
        res.on("data", (chunk) => {
          responseData += chunk;
        });
        res.on("end", () => {
          try {
            const response = JSON.parse(responseData);
            resolve({ success: true, ...response });
          } catch (error) {
            reject(new Error("Invalid response from Planning MCP Bridge" + error));
          }
        });
      });
      req.on("error", (error) => {
        if (error.message.includes("ECONNREFUSED")) {
          reject(
            new Error(
              "Planning MCP Bridge is not running. Please ensure it is started on port " + bridgePort
            )
          );
        } else {
          reject(error);
        }
      });
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
      req.write(postData);
      req.end();
    });
  }
};

// src/mcp/planning/tools/GetCurrentSlideTool.ts
var GetCurrentSlideTool = class extends PlanningBaseTool {
  constructor() {
    super(...arguments);
    this.name = "planning_getCurrentSlide";
    this.description = "Get the current slide in the planning document";
    this.schema = import_zod2.z.object({
      filePath: import_zod2.z.string().describe("The path to the planning document")
    });
  }
  async execute(input) {
    const { filePath } = input;
    try {
      const response = await this.makeRequest("/slide/current", { filePath });
      if (response.success) {
        const slideNumber = response.slideNumber;
        const totalSlides = response.totalSlides;
        const content = response.content;
        return {
          content: [
            {
              type: "text",
              text: `Slide ${slideNumber + 1} of ${totalSlides}:

${content}`,
              data: response
            }
          ]
        };
      } else {
        return this.createErrorResponse(String(response.error) || "Failed to get current slide");
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to get current slide"
      );
    }
  }
};

// src/mcp/planning/tools/NavigateToSlideTool.ts
var import_zod3 = require("zod");
var NavigateToSlideTool = class extends PlanningBaseTool {
  constructor() {
    super(...arguments);
    this.name = "planning_navigateToSlide";
    this.description = "Navigate to a specific slide number in the planning document";
    this.schema = import_zod3.z.object({
      filePath: import_zod3.z.string().describe("The path to the planning document"),
      slideNumber: import_zod3.z.number().describe("The slide number to navigate to (0-indexed)")
    });
  }
  async execute(input) {
    const { filePath, slideNumber } = input;
    try {
      const response = await this.makeRequest("/slide/navigate", { filePath, slideNumber });
      if (response.success) {
        const currentSlide = response.currentSlide;
        const content = response.content;
        return {
          content: [
            {
              type: "text",
              text: `Navigated to slide ${currentSlide + 1}:

${content}`,
              data: response
            }
          ]
        };
      } else {
        return this.createErrorResponse(String(response.error) || "Failed to navigate to slide");
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to navigate to slide"
      );
    }
  }
};

// src/mcp/planning/tools/UpdateSlideTool.ts
var import_zod4 = require("zod");
var UpdateSlideTool = class extends PlanningBaseTool {
  constructor() {
    super(...arguments);
    this.name = "planning_updateSlide";
    this.description = "Update the content of a specific slide in the planning document";
    this.schema = import_zod4.z.object({
      filePath: import_zod4.z.string().describe("The path to the planning document"),
      slideNumber: import_zod4.z.number().describe("The slide number to update (0-indexed)"),
      content: import_zod4.z.string().describe("The new content for the slide"),
      autoSave: import_zod4.z.boolean().optional().default(false).describe("Whether to save the document after updating")
    });
  }
  async execute(input) {
    const { filePath, slideNumber, content, autoSave } = input;
    try {
      const response = await this.makeRequest("/slide/update", {
        filePath,
        slideNumber,
        content,
        autoSave
      });
      if (response.success) {
        return {
          content: [
            {
              type: "text",
              text: `Successfully updated slide ${slideNumber + 1}${autoSave ? " and saved document" : ""}`,
              data: response
            }
          ]
        };
      } else {
        return this.createErrorResponse(String(response.error) || "Failed to update slide");
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to update slide"
      );
    }
  }
};

// src/mcp/planning/tools/CreateSlideTool.ts
var import_zod5 = require("zod");
var CreateSlideTool = class extends PlanningBaseTool {
  constructor() {
    super(...arguments);
    this.name = "planning_createSlide";
    this.description = "Create a new slide in the planning document";
    this.schema = import_zod5.z.object({
      filePath: import_zod5.z.string().describe("The path to the planning document"),
      position: import_zod5.z.enum(["before", "after", "end"]).describe("Where to insert the new slide relative to current slide"),
      content: import_zod5.z.string().optional().default("# New Slide\n\nContent here...").describe("The content for the new slide"),
      autoSave: import_zod5.z.boolean().optional().default(false).describe("Whether to save the document after creating")
    });
  }
  async execute(input) {
    const { filePath, position, content, autoSave } = input;
    try {
      const response = await this.makeRequest("/slide/create", {
        filePath,
        position,
        content,
        autoSave
      });
      if (response.success) {
        const slideNumber = response.slideNumber;
        const totalSlides = response.totalSlides;
        return {
          content: [
            {
              type: "text",
              text: `Created new slide at position ${slideNumber + 1}. Total slides: ${totalSlides}`,
              data: response
            }
          ]
        };
      } else {
        return this.createErrorResponse(String(response.error) || "Failed to create slide");
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to create slide"
      );
    }
  }
};

// src/mcp/planning/tools/StartPlanningTool.ts
var import_zod6 = require("zod");
var StartPlanningTool = class extends PlanningBaseTool {
  constructor() {
    super(...arguments);
    this.name = "start_planning";
    this.description = "Start a planning session. Shows a UI for the user to select an existing planning document or create a new one.";
    this.schema = import_zod6.z.object({
      agentName: import_zod6.z.string().describe("The name of the agent requesting to open a document"),
      suggestedTitle: import_zod6.z.string().optional().describe("Optional suggested title for a new document"),
      suggestedType: import_zod6.z.enum(["markdown", "excalidraw"]).optional().describe("Optional suggested document type"),
      message: import_zod6.z.string().optional().describe("Optional message to show to the user")
    });
  }
  async execute(input) {
    const { agentName, suggestedTitle, suggestedType, message } = input;
    try {
      const response = await this.makeRequest("/document/open", {
        agentName,
        suggestedTitle,
        suggestedType,
        message
      });
      if (response.success) {
        if (response.documentSelected) {
          return {
            content: [
              {
                type: "text",
                text: `Document opened: ${response.documentTitle}
Type: ${response.documentType}
Path: ${response.filePath || "In-memory"}`,
                data: response
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: "User cancelled document selection",
                data: { cancelled: true }
              }
            ]
          };
        }
      } else {
        return this.createErrorResponse(String(response.error) || "Failed to open document");
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : "Failed to open document"
      );
    }
  }
};

// src/mcp/tools/UserPromptTool.ts
var http2 = __toESM(require("http"));
var import_zod7 = require("zod");
var UserPromptTool = class extends BaseTool {
  constructor() {
    super(...arguments);
    this.name = "user_prompt";
    this.description = "Request input from the user through a dialog prompt";
    this.schema = import_zod7.z.object({
      filePath: import_zod7.z.string().describe("The path to the file or directory relevant to the prompt"),
      message: import_zod7.z.string().describe("The message to show to the user"),
      title: import_zod7.z.string().optional().default("MCP Prompt").describe("The title of the prompt dialog"),
      type: import_zod7.z.enum(["text", "confirm", "select", "multiline"]).optional().default("text").describe("The type of prompt"),
      options: import_zod7.z.array(import_zod7.z.string()).optional().describe("Options for select type prompts"),
      defaultValue: import_zod7.z.union([import_zod7.z.string(), import_zod7.z.boolean()]).optional().describe("Default value for the prompt"),
      placeholder: import_zod7.z.string().optional().describe("Placeholder text for input fields"),
      required: import_zod7.z.boolean().optional().default(false).describe("Whether the user must provide a value"),
      timeout: import_zod7.z.number().optional().describe("Timeout in milliseconds (optional)")
    });
  }
  async execute(input) {
    return new Promise((resolve) => {
      const bridgeHost = process.env.MCP_BRIDGE_HOST || "localhost";
      const bridgePort = parseInt(process.env.MCP_BRIDGE_PORT || "3042");
      const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestData = {
        id: promptId,
        filePath: input.filePath,
        title: input.title || "MCP Prompt",
        message: input.message,
        type: input.type || "text",
        options: input.options,
        defaultValue: input.defaultValue,
        placeholder: input.placeholder,
        required: input.required || false,
        timeout: input.timeout
      };
      const postData = JSON.stringify(requestData);
      const options = {
        hostname: bridgeHost,
        port: bridgePort,
        path: "/mcp-prompt",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: input.timeout || 6e4
        // Default 60 second timeout
      };
      const req = http2.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            if (response.success) {
              resolve({
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        success: true,
                        value: response.value,
                        promptId: response.id
                      },
                      null,
                      2
                    )
                  }
                ]
              });
            } else {
              const errorMessage = response.cancelled ? "User cancelled the prompt" : response.error || "Failed to get user response";
              resolve({
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        success: false,
                        error: errorMessage,
                        cancelled: response.cancelled || false,
                        promptId: response.id
                      },
                      null,
                      2
                    )
                  }
                ],
                isError: !response.cancelled
                // Don't treat cancellation as an error
              });
            }
          } catch (error) {
            resolve({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: false,
                      error: `Invalid response from MCP Bridge: ${data}: ${error}`
                    },
                    null,
                    2
                  )
                }
              ],
              isError: true
            });
          }
        });
      });
      req.on("error", (error) => {
        console.error("[UserPromptTool] Error:", error);
        let errorMessage = "Failed to show prompt";
        if (error.message.includes("ECONNREFUSED")) {
          errorMessage = BRANDING.MCP_BRIDGE_ERROR;
        } else {
          errorMessage = error.message;
        }
        resolve({
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: errorMessage
                },
                null,
                2
              )
            }
          ],
          isError: true
        });
      });
      req.on("timeout", () => {
        req.destroy();
        resolve({
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: "Request timed out"
                },
                null,
                2
              )
            }
          ],
          isError: true
        });
      });
      req.write(postData);
      req.end();
    });
  }
};

// src/mcp/tools/AgentHandoffTool.ts
var http3 = __toESM(require("http"));
var import_zod8 = require("zod");
var AgentHandoffTool = class extends BaseTool {
  constructor() {
    super(...arguments);
    this.name = "agent-context-handoff";
    this.description = "Hand off context to another AI agent for continuation of work";
    this.schema = import_zod8.z.strictObject({
      context: import_zod8.z.string().describe(
        "Markdown-formatted context including work completed, current state, relevant files, and next steps"
      )
    });
  }
  async execute(params) {
    try {
      const response = await this.makeHttpRequest(params);
      if (response.success) {
        return this.createSuccessResponse(
          `Successfully initiated agent handoff. Handoff ID: ${response.handoffId}`,
          response
        );
      } else {
        return this.createErrorResponse(
          `Failed to initiate agent handoff: ${response.message || "Unknown error"}`
        );
      }
    } catch (error) {
      return this.createErrorResponse(
        `Error during agent handoff: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async makeHttpRequest(params) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(params);
      const options = {
        hostname: "localhost",
        port: 20652,
        path: "/agent-context-handoff",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        }
      };
      const req = http3.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data} ${error}`));
          }
        });
      });
      req.on("error", (error) => {
        reject(new Error(`HTTP request failed: ${error.message} ${error.stack}`));
      });
      req.write(postData);
      req.end();
    });
  }
};

// src/mcp/server/McpServer.ts
var McpServer = class {
  constructor(config) {
    this.tools = /* @__PURE__ */ new Map();
    this.resources = /* @__PURE__ */ new Map();
    this.messageQueue = [];
    this.config = config;
    this.server = new import_server.Server(
      {
        name: config.name,
        version: config.version
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );
    this.setupDefaultTools();
    this.setupDefaultResources();
    this.registerHandlers();
  }
  setupDefaultTools() {
    this.addTool(new UserPromptTool());
    this.addTool(new StartPlanningTool());
    this.addTool(new GetCurrentSlideTool());
    this.addTool(new NavigateToSlideTool());
    this.addTool(new UpdateSlideTool());
    this.addTool(new CreateSlideTool());
    this.addTool(new AgentHandoffTool());
  }
  setupDefaultResources() {
    this.addResource({
      uri: "app://status",
      name: "Application Status",
      description: "Current application status and metrics",
      mimeType: "application/json",
      handler: async () => {
        const status = {
          status: "running",
          messageQueue: this.messageQueue.length,
          timestamp: Date.now(),
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        };
        return JSON.stringify(status, null, 2);
      }
    });
  }
  registerHandlers() {
    this.server.setRequestHandler(import_types.ListToolsRequestSchema, async () => {
      const toolList = [];
      for (const [, tool] of this.tools.entries()) {
        toolList.push({
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema || {}
        });
      }
      return { tools: toolList };
    });
    this.server.setRequestHandler(import_types.CallToolRequestSchema, async (request4) => {
      const { name, arguments: args } = request4.params;
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }
      const result = await tool.handler(args || {});
      return {
        content: result.content
      };
    });
    this.server.setRequestHandler(import_types.ListResourcesRequestSchema, async () => {
      const resourceList = [];
      for (const [, resource] of this.resources.entries()) {
        resourceList.push({
          uri: resource.uri,
          name: resource.name,
          description: resource.description || "",
          mimeType: resource.mimeType || "text/plain"
        });
      }
      return { resources: resourceList };
    });
    this.server.setRequestHandler(import_types.ReadResourceRequestSchema, async (request4) => {
      const { uri } = request4.params;
      const resource = this.resources.get(uri);
      if (!resource) {
        throw new Error(`Unknown resource: ${uri}`);
      }
      const content = await resource.handler();
      return {
        contents: [
          {
            uri: resource.uri,
            mimeType: resource.mimeType || "text/plain",
            text: typeof content === "string" ? content : JSON.stringify(content, null, 2)
          }
        ]
      };
    });
  }
  addTool(tool) {
    this.tools.set(tool.name, tool);
  }
  addResource(resource) {
    this.resources.set(resource.uri, resource);
  }
  async start() {
    const transport = new import_stdio.StdioServerTransport();
    await this.server.connect(transport);
    console.error(`\u2705 ${this.config.name} MCP server started successfully`);
  }
  async stop() {
    console.error(`${this.config.name} MCP server stopped`);
  }
};

// src/mcp/index.ts
if (require.main === module) {
  const config = {
    name: BRANDING.MCP_SERVER_NAME,
    version: BRANDING.MCP_VERSION,
    httpBridgePort: parseInt(process.env.HTTP_BRIDGE_PORT || "3042"),
    httpBridgeHost: process.env.HTTP_BRIDGE_HOST || "localhost",
    httpBridgePath: process.env.HTTP_BRIDGE_PATH || "/mcp-message"
  };
  const server = new McpServer(config);
  process.on("SIGINT", async () => {
    console.error("\nShutting down MCP server...");
    await server.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    console.error("\nShutting down MCP server...");
    await server.stop();
    process.exit(0);
  });
  server.start().catch((error) => {
    console.error("\u274C Failed to start MCP server:", error);
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BaseTool,
  McpServer
});

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPromptTool = void 0;
const http = __importStar(require("http"));
const zod_1 = require("zod");
const branding_1 = require("../../constants/branding");
const base_tool_1 = require("./base-tool");
/**
 * UserPromptTool - MCP tool for requesting user input
 *
 * This tool allows MCP servers to show prompts to users and get their responses.
 * It communicates with the Electron app via the MCP HTTP Bridge.
 */
class UserPromptTool extends base_tool_1.BaseTool {
    constructor() {
        super(...arguments);
        this.name = 'user_prompt';
        this.description = 'Request input from the user through a dialog prompt';
        this.schema = zod_1.z.object({
            filePath: zod_1.z.string().describe('The path to the file or directory relevant to the prompt'),
            message: zod_1.z.string().describe('The message to show to the user'),
            title: zod_1.z.string().optional().default('MCP Prompt').describe('The title of the prompt dialog'),
            type: zod_1.z
                .enum(['text', 'confirm', 'select', 'multiline'])
                .optional()
                .default('text')
                .describe('The type of prompt'),
            options: zod_1.z.array(zod_1.z.string()).optional().describe('Options for select type prompts'),
            defaultValue: zod_1.z
                .union([zod_1.z.string(), zod_1.z.boolean()])
                .optional()
                .describe('Default value for the prompt'),
            placeholder: zod_1.z.string().optional().describe('Placeholder text for input fields'),
            required: zod_1.z
                .boolean()
                .optional()
                .default(false)
                .describe('Whether the user must provide a value'),
            timeout: zod_1.z.number().optional().describe('Timeout in milliseconds (optional)'),
        });
    }
    async execute(input) {
        return new Promise(resolve => {
            const bridgeHost = process.env.MCP_BRIDGE_HOST || 'localhost';
            const bridgePort = parseInt(process.env.MCP_BRIDGE_PORT || '3042');
            // Generate unique ID for this prompt
            const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const requestData = {
                id: promptId,
                filePath: input.filePath,
                title: input.title || 'MCP Prompt',
                message: input.message,
                type: input.type || 'text',
                options: input.options,
                defaultValue: input.defaultValue,
                placeholder: input.placeholder,
                required: input.required || false,
                timeout: input.timeout,
            };
            const postData = JSON.stringify(requestData);
            const options = {
                hostname: bridgeHost,
                port: bridgePort,
                path: '/mcp-prompt',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: input.timeout || 60000, // Default 60 second timeout
            };
            const req = http.request(options, res => {
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.success) {
                            resolve({
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            value: response.value,
                                            promptId: response.id,
                                        }, null, 2),
                                    },
                                ],
                            });
                        }
                        else {
                            const errorMessage = response.cancelled
                                ? 'User cancelled the prompt'
                                : response.error || 'Failed to get user response';
                            resolve({
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: false,
                                            error: errorMessage,
                                            cancelled: response.cancelled || false,
                                            promptId: response.id,
                                        }, null, 2),
                                    },
                                ],
                                isError: !response.cancelled, // Don't treat cancellation as an error
                            });
                        }
                    }
                    catch (error) {
                        resolve({
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify({
                                        success: false,
                                        error: `Invalid response from MCP Bridge: ${data}: ${error}`,
                                    }, null, 2),
                                },
                            ],
                            isError: true,
                        });
                    }
                });
            });
            req.on('error', (error) => {
                console.error('[UserPromptTool] Error:', error);
                let errorMessage = 'Failed to show prompt';
                if (error.message.includes('ECONNREFUSED')) {
                    errorMessage = branding_1.BRANDING.MCP_BRIDGE_ERROR;
                }
                else {
                    errorMessage = error.message;
                }
                // @eslint-disable-next-line
                resolve({
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: false,
                                error: errorMessage,
                            }, null, 2),
                        },
                    ],
                    isError: true,
                });
            });
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: false,
                                error: 'Request timed out',
                            }, null, 2),
                        },
                    ],
                    isError: true,
                });
            });
            req.write(postData);
            req.end();
        });
    }
}
exports.UserPromptTool = UserPromptTool;

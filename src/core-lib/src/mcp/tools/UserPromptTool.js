import * as http from 'http';
import { z } from 'zod';
import { BRANDING } from '../../constants/branding';
import { BaseTool } from './base-tool';
/**
 * UserPromptTool - MCP tool for requesting user input
 *
 * This tool allows MCP servers to show prompts to users and get their responses.
 * It communicates with the Electron app via the MCP HTTP Bridge.
 */
export class UserPromptTool extends BaseTool {
    constructor() {
        super(...arguments);
        this.name = 'user_prompt';
        this.description = 'Request input from the user through a dialog prompt';
        this.schema = z.object({
            filePath: z.string().describe('The path to the file or directory relevant to the prompt'),
            message: z.string().describe('The message to show to the user'),
            title: z.string().optional().default('MCP Prompt').describe('The title of the prompt dialog'),
            type: z
                .enum(['text', 'confirm', 'select', 'multiline'])
                .optional()
                .default('text')
                .describe('The type of prompt'),
            options: z.array(z.string()).optional().describe('Options for select type prompts'),
            defaultValue: z
                .union([z.string(), z.boolean()])
                .optional()
                .describe('Default value for the prompt'),
            placeholder: z.string().optional().describe('Placeholder text for input fields'),
            required: z
                .boolean()
                .optional()
                .default(false)
                .describe('Whether the user must provide a value'),
            timeout: z.number().optional().describe('Timeout in milliseconds (optional)'),
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
                    errorMessage = BRANDING.MCP_BRIDGE_ERROR;
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

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
exports.AgentHandoffTool = void 0;
const http = __importStar(require("http"));
const zod_1 = require("zod");
const base_tool_1 = require("./base-tool");
class AgentHandoffTool extends base_tool_1.BaseTool {
    constructor() {
        super(...arguments);
        this.name = 'agent-context-handoff';
        this.description = 'Hand off context to another AI agent for continuation of work';
        this.schema = zod_1.z.strictObject({
            context: zod_1.z
                .string()
                .describe('Markdown-formatted context including work completed, current state, relevant files, and next steps'),
        });
    }
    async execute(params) {
        try {
            // Make HTTP request to the Electron HTTP bridge
            const response = await this.makeHttpRequest(params);
            if (response.success) {
                return this.createSuccessResponse(`Successfully initiated agent handoff. Handoff ID: ${response.handoffId}`, response);
            }
            else {
                return this.createErrorResponse(`Failed to initiate agent handoff: ${response.message || 'Unknown error'}`);
            }
        }
        catch (error) {
            return this.createErrorResponse(`Error during agent handoff: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async makeHttpRequest(params) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(params);
            const options = {
                hostname: 'localhost',
                port: 20652,
                path: '/agent-context-handoff',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
            };
            const req = http.request(options, res => {
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    }
                    catch (error) {
                        reject(new Error(`Failed to parse response: ${data} ${error}`));
                    }
                });
            });
            req.on('error', error => {
                reject(new Error(`HTTP request failed: ${error.message} ${error.stack}`));
            });
            req.write(postData);
            req.end();
        });
    }
}
exports.AgentHandoffTool = AgentHandoffTool;

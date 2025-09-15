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
exports.PlanningBaseTool = void 0;
const http = __importStar(require("http"));
const base_tool_1 = require("../../tools/base-tool");
/**
 * Base class for Planning MCP tools
 * Provides shared HTTP request functionality for communicating with the Planning MCP Bridge
 */
class PlanningBaseTool extends base_tool_1.BaseTool {
    async makeRequest(path, data) {
        return new Promise((resolve, reject) => {
            const bridgeHost = process.env.PLANNING_BRIDGE_HOST || 'localhost';
            const bridgePort = parseInt(process.env.PLANNING_BRIDGE_PORT || '3045');
            const postData = JSON.stringify(data);
            const options = {
                hostname: bridgeHost,
                port: bridgePort,
                path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: 5000,
            };
            const req = http.request(options, res => {
                let responseData = '';
                res.on('data', chunk => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        resolve({ success: true, ...response });
                    }
                    catch (error) {
                        reject(new Error('Invalid response from Planning MCP Bridge' + error));
                    }
                });
            });
            req.on('error', error => {
                if (error.message.includes('ECONNREFUSED')) {
                    reject(new Error('Planning MCP Bridge is not running. Please ensure it is started on port ' +
                        bridgePort));
                }
                else {
                    reject(error);
                }
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.write(postData);
            req.end();
        });
    }
}
exports.PlanningBaseTool = PlanningBaseTool;

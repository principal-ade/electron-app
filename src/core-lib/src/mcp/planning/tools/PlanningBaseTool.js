import * as http from 'http';
import { BaseTool } from '../../tools/base-tool';
/**
 * Base class for Planning MCP tools
 * Provides shared HTTP request functionality for communicating with the Planning MCP Bridge
 */
export class PlanningBaseTool extends BaseTool {
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

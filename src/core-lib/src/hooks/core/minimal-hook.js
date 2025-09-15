#!/usr/bin/env node
/**
 * Minimal Hook - Zero Config Pass-Through
 * Tries HTTP to agent session events bridge, falls back to file storage
 */
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { stdin, exit } from 'process';
import { AGENT_INFO } from '../../agents';
import { BRANDING } from '../../constants/branding';
export class MinimalHook {
    constructor(agent) {
        const agentInfo = AGENT_INFO[agent];
        // Use a writable directory - check for common locations
        const writableDir = this.getWritableDirectory();
        // Store events in the writable directory
        this.fallbackFile = path.join(writableDir, agentInfo.fallbackFileName);
        // Error file uses same name pattern but with -errors suffix
        this.errorFile = path.join(writableDir, agentInfo.errorFileName);
        this.bridgeRoute = agentInfo.bridgeRoute;
    }
    getWritableDirectory() {
        // Try different locations in order of preference
        const possibleDirs = [
            // User's home directory with a specific folder for our app
            path.join(process.env.HOME || '', '.a24z', 'hooks'),
            // Temp directory as fallback
            path.join(process.env.TMPDIR || '/tmp', '.a24z-hooks'),
            // Current working directory as last resort
            path.join(process.cwd(), '.a24z-hooks'),
        ];
        for (const dir of possibleDirs) {
            try {
                // Try to create the directory if it doesn't exist
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                // Test if we can write to it
                const testFile = path.join(dir, '.write-test');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                return dir;
            }
            catch {
                // If this directory doesn't work, try the next one
                continue;
            }
        }
        // If none work, use temp directory without testing
        return process.env.TMPDIR || '/tmp';
    }
    async run() {
        try {
            const rawData = await this.readStdin();
            // Try HTTP first
            try {
                await this.sendHttp(rawData);
            }
            catch (httpError) {
                // Log HTTP error
                await this.logError(httpError, 'http_send_failed', {
                    path: this.bridgeRoute,
                    dataLength: rawData.length,
                });
                // If HTTP fails, save to file
                await this.saveToFile(rawData);
            }
            exit(0);
        }
        catch (error) {
            await this.logError(error, 'hook_fatal_error');
            console.error('Hook error:', error);
            exit(1);
        }
    }
    readStdin() {
        return new Promise((resolve, reject) => {
            let data = '';
            const timeout = setTimeout(() => {
                reject(new Error('Timeout reading stdin'));
            }, 5000);
            stdin.setEncoding('utf8');
            stdin.on('data', chunk => (data += chunk));
            stdin.on('end', () => {
                clearTimeout(timeout);
                resolve(data);
            });
            stdin.on('error', async (error) => {
                clearTimeout(timeout);
                await this.logError(error, 'stdin_read_error');
                reject(error);
            });
        });
    }
    sendHttp(data) {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: BRANDING.BRIDGE_PORTS.AGENT_SESSION_EVENTS,
                path: `/${this.bridgeRoute}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                },
                timeout: 5000,
            }, res => {
                res.on('data', () => { }); // Consume response
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        resolve();
                    }
                    else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.write(data);
            req.end();
        });
    }
    async saveToFile(data) {
        try {
            const parsed = JSON.parse(data);
            const event = {
                ...parsed,
                __hook_timestamp: new Date().toISOString(),
                __hook_received: Date.now(),
            };
            // Read existing events
            let events = [];
            if (fs.existsSync(this.fallbackFile)) {
                try {
                    const content = fs.readFileSync(this.fallbackFile, 'utf8');
                    events = JSON.parse(content);
                    if (!Array.isArray(events)) {
                        events = [events];
                    }
                }
                catch {
                    events = [];
                }
            }
            // Append and save
            events.push(event);
            fs.writeFileSync(this.fallbackFile, JSON.stringify(events, null, 2));
        }
        catch (parseError) {
            await this.logError(parseError, 'json_parse_error', {
                rawDataPreview: data.substring(0, 200),
            });
            // If JSON parsing fails, save raw
            const rawEvent = {
                __hook_raw: data,
                __hook_timestamp: new Date().toISOString(),
                __hook_received: Date.now(),
            };
            let events = [];
            if (fs.existsSync(this.fallbackFile)) {
                try {
                    const content = fs.readFileSync(this.fallbackFile, 'utf8');
                    events = JSON.parse(content);
                }
                catch (readError) {
                    await this.logError(readError, 'fallback_file_read_error', { file: this.fallbackFile });
                    events = [];
                }
            }
            events.push(rawEvent);
            fs.writeFileSync(this.fallbackFile, JSON.stringify(events, null, 2));
        }
    }
    async logError(error, context, additionalData) {
        try {
            const errorObj = error;
            const errorEntry = {
                timestamp: new Date().toISOString(),
                context,
                error: {
                    message: errorObj?.message || String(error),
                    stack: errorObj?.stack,
                    name: errorObj?.name,
                    code: errorObj?.code,
                },
                additionalData,
                __hook_error_logged: Date.now(),
            };
            // Read existing errors
            let errors = [];
            if (fs.existsSync(this.errorFile)) {
                try {
                    const content = fs.readFileSync(this.errorFile, 'utf8');
                    errors = JSON.parse(content);
                    if (!Array.isArray(errors)) {
                        errors = [errors];
                    }
                }
                catch {
                    errors = [];
                }
            }
            // Append and save
            errors.push(errorEntry);
            fs.writeFileSync(this.errorFile, JSON.stringify(errors, null, 2));
        }
        catch (logError) {
            // If we can't log the error, at least print it
            console.error('Failed to log error:', logError);
            console.error('Original error:', error);
        }
    }
}

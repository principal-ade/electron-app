#!/usr/bin/env node
"use strict";
var C = Object.create;
var h = Object.defineProperty;
var y = Object.getOwnPropertyDescriptor;
var O = Object.getOwnPropertyNames;
var E = Object.getPrototypeOf, b = Object.prototype.hasOwnProperty;
var P = (s, o, t, n) => { if (o && typeof o == "object" || typeof o == "function")
    for (let e of O(o))
        !b.call(s, e) && e !== t && h(s, e, { get: () => o[e], enumerable: !(n = y(o, e)) || n.enumerable }); return s; };
var m = (s, o, t) => (t = s != null ? C(E(s)) : {}, P(o || !s || !s.__esModule ? h(t, "default", { value: s, enumerable: !0 }) : t, s));
var d = { COMPANY_NAME: "A24Z", PRODUCT_NAME: "specktor.ai", APP_NAME: "Specktor", MCP_SERVER_NAME: "principal-ai-mcp-server", MCP_SERVER_CONFIG_KEY: "principal-ai", MCP_SERVER_FILENAME: "principal-ai-mcp-server.cjs", MCP_SERVER_BUNDLE_NAME: "principal-ai-mcp-server.js", MCP_FALLBACK_DIR: ".a24z-mcp", VERSION_FLAG: "--principal-ai-version", APP_NOT_RUNNING_ERROR: "The principal.ai application isnt open", MCP_BRIDGE_ERROR: "Unable to connect to MCP bridge. Please ensure the PrincipalAI app is running.", SCAFFOLD_ERROR: "No scaffold layers found. Generate architectural analysis first using the PrincipalAI app.", EXCALIDRAW_ERROR: "Retrieving Excalidraw drawings requires the PrincipalAI app to be running.", SEMANTIC_SEARCH_ERROR: "Semantic file search requires the PrincipalAI app to be running with architectural scaffold layers generated.", APP_VERSION: "1.0.2", MCP_VERSION: "1.0.0", BRIDGE_PORTS: { AGENT_SESSION_EVENTS: 3043, PLANNING_MCP: 3045 } };
var c = (n => (n.CLAUDE = "claude", n.GEMINI = "gemini", n.OPENCODE = "opencode", n))(c || {}), v = Object.values(c);
var g = { claude: { name: "claude", displayName: "Claude Code", installation: { source: "github-release", artifactType: "native-binary", runtime: "none", binaryName: "claude", requiresWrapper: !1, platformSpecific: !0 }, openSource: { isOpenSource: !1, repository: "https://github.com/anthropics/claude-code" }, documentation: { hooks: "https://docs.anthropic.com/en/docs/claude-code/hooks", general: "https://docs.anthropic.com/en/docs/claude-code", setup: "https://docs.anthropic.com/en/docs/claude-code/quickstart" }, ui: { color: "#da7756", downloadUrl: "https://docs.anthropic.com/en/docs/claude-code/quickstart", description: "Anthropic's AI assistant for code" }, settingsSchema: "https://json.schemastore.org/claude-code-settings.json", settingsPath: "~/.claude/settings.json", hooksConfigurationPath: "~/.claude/settings.json", mcpConfigurationPath: "~/.claude.json", hookPath: "hooks/claude-hook.cjs", bridgeRoute: "claude-hook", fallbackFileName: "claude-hook-events.json", errorFileName: "claude-hook-events-errors.json", storageEventsNamespace: "claude-hook-events" }, gemini: { name: "gemini", displayName: "Gemini Cli", installation: { source: "github-release", artifactType: "node-module-esm", runtime: "node", githubRepo: "principle-md/gemini-cli", binaryName: "principal-gemini", assetName: "gemini.mjs", requiresWrapper: !0, platformSpecific: !1 }, openSource: { isOpenSource: !0, license: "MIT", repository: "https://github.com/google-gemini/gemini-cli", supportsHooks: !1, hookSupportingFork: "https://github.com/principle-md/gemini-cli" }, documentation: { general: "https://cloud.google.com/gemini/docs/code-assist" }, ui: { color: "#4796E3", downloadUrl: "https://github.com/principle-md/gemini-cli/tree/add-hooks-feature", description: "Google's AI code assistant with hooks support" }, settingsSchema: "https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/config/settings.ts", settingsPath: "~/.gemini/settings.json", hooksConfigurationPath: "~/.gemini/settings.json", mcpConfigurationPath: "~/.gemini/settings.json", bridgeRoute: "gemini-hook", hookPath: "hooks/gemini-hook.cjs", fallbackFileName: "gemini-hook-events.json", errorFileName: "gemini-hook-events-errors.json", storageEventsNamespace: "gemini-hook-events" }, opencode: { name: "opencode", displayName: "OpenCode", installation: { source: "github-release", artifactType: "native-binary", runtime: "none", githubRepo: "principle-md/opencode", binaryName: "principal-opencode", requiresWrapper: !1, platformSpecific: !0 }, openSource: { isOpenSource: !0, license: "MIT", repository: "https://github.com/sst/opencode", supportsHooks: !0, hookSupportingFork: "https://github.com/principle-md/opencode" }, documentation: { general: "https://github.com/opencodeinterpreter/opencode#readme" }, ui: { color: "#10B981", downloadUrl: "https://github.com/opencodeinterpreter/opencode/releases", description: "Open source code interpreter with AI assistance" }, settingsSchema: "https://opencode.ai/config.json", settingsPath: "~/.config/openCode/openCode.json", hooksConfigurationPath: "~/.config/openCode/openCode.json", mcpConfigurationPath: "~/.config/openCode/openCode.json", bridgeRoute: "opencode-hook", hookPath: "hooks/opencode-hook.cjs", fallbackFileName: "opencode-hook-events.json", errorFileName: "opencode-hook-events-errors.json", storageEventsNamespace: "opencode-hook-events" } };
var r = m(require("fs")), _ = m(require("http")), l = m(require("path")), a = require("process");
var u = class {
    constructor(o) { let t = g[o], n = this.getWritableDirectory(); this.fallbackFile = l.join(n, t.fallbackFileName), this.errorFile = l.join(n, t.errorFileName), this.bridgeRoute = t.bridgeRoute; }
    getWritableDirectory() { let o = [l.join(process.env.HOME || "", ".a24z", "hooks"), l.join(process.env.TMPDIR || "/tmp", ".a24z-hooks"), l.join(process.cwd(), ".a24z-hooks")]; for (let t of o)
        try {
            r.existsSync(t) || r.mkdirSync(t, { recursive: !0 });
            let n = l.join(t, ".write-test");
            return r.writeFileSync(n, "test"), r.unlinkSync(n), t;
        }
        catch {
            continue;
        } return process.env.TMPDIR || "/tmp"; }
    async run() { try {
        let o = await this.readStdin();
        try {
            await this.sendHttp(o);
        }
        catch (t) {
            await this.logError(t, "http_send_failed", { path: this.bridgeRoute, dataLength: o.length }), await this.saveToFile(o);
        }
        (0, a.exit)(0);
    }
    catch (o) {
        await this.logError(o, "hook_fatal_error"), console.error("Hook error:", o), (0, a.exit)(1);
    } }
    readStdin() { return new Promise((o, t) => { let n = "", e = setTimeout(() => { t(new Error("Timeout reading stdin")); }, 5e3); a.stdin.setEncoding("utf8"), a.stdin.on("data", i => n += i), a.stdin.on("end", () => { clearTimeout(e), o(n); }), a.stdin.on("error", async (i) => { clearTimeout(e), await this.logError(i, "stdin_read_error"), t(i); }); }); }
    sendHttp(o) { return new Promise((t, n) => { let e = _.request({ hostname: "localhost", port: d.BRIDGE_PORTS.AGENT_SESSION_EVENTS, path: `/${this.bridgeRoute}`, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(o) }, timeout: 5e3 }, i => { i.on("data", () => { }), i.on("end", () => { i.statusCode === 200 || i.statusCode === 201 ? t() : n(new Error(`HTTP ${i.statusCode}`)); }); }); e.on("error", n), e.on("timeout", () => { e.destroy(), n(new Error("Request timeout")); }), e.write(o), e.end(); }); }
    async saveToFile(o) { try {
        let n = { ...JSON.parse(o), __hook_timestamp: new Date().toISOString(), __hook_received: Date.now() }, e = [];
        if (r.existsSync(this.fallbackFile))
            try {
                let i = r.readFileSync(this.fallbackFile, "utf8");
                e = JSON.parse(i), Array.isArray(e) || (e = [e]);
            }
            catch {
                e = [];
            }
        e.push(n), r.writeFileSync(this.fallbackFile, JSON.stringify(e, null, 2));
    }
    catch (t) {
        await this.logError(t, "json_parse_error", { rawDataPreview: o.substring(0, 200) });
        let n = { __hook_raw: o, __hook_timestamp: new Date().toISOString(), __hook_received: Date.now() }, e = [];
        if (r.existsSync(this.fallbackFile))
            try {
                let i = r.readFileSync(this.fallbackFile, "utf8");
                e = JSON.parse(i);
            }
            catch (i) {
                await this.logError(i, "fallback_file_read_error", { file: this.fallbackFile }), e = [];
            }
        e.push(n), r.writeFileSync(this.fallbackFile, JSON.stringify(e, null, 2));
    } }
    async logError(o, t, n) { try {
        let e = o, i = { timestamp: new Date().toISOString(), context: t, error: { message: e?.message || String(o), stack: e?.stack, name: e?.name, code: e?.code }, additionalData: n, __hook_error_logged: Date.now() }, p = [];
        if (r.existsSync(this.errorFile))
            try {
                let S = r.readFileSync(this.errorFile, "utf8");
                p = JSON.parse(S), Array.isArray(p) || (p = [p]);
            }
            catch {
                p = [];
            }
        p.push(i), r.writeFileSync(this.errorFile, JSON.stringify(p, null, 2));
    }
    catch (e) {
        console.error("Failed to log error:", e), console.error("Original error:", o);
    } }
};
var K = "claude", $ = new u(K);
$.run();

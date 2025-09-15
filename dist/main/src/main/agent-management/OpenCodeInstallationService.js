import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { app } from 'electron';
import { BaseAgentInstallationService } from './BaseAgentInstallationService';
import { CUSTOM_INSTALL_DIRECTORY, SupportedAgent, getAgentInfo } from "@principal-ai/agent-monitoring";
import { AgentConfigurationService } from './AgentConfigurationService';
const execAsync = promisify(exec);
export class OpenCodeInstallationService extends BaseAgentInstallationService {
    static instance;
    agentInfo = getAgentInfo(SupportedAgent.OPENCODE);
    constructor() {
        super(SupportedAgent.OPENCODE, getAgentInfo(SupportedAgent.OPENCODE));
    }
    static getInstance() {
        if (!OpenCodeInstallationService.instance) {
            OpenCodeInstallationService.instance = new OpenCodeInstallationService();
        }
        return OpenCodeInstallationService.instance;
    }
    getAssetNameForRelease(release) {
        // OpenCode releases binaries with platform-specific names
        const platform = process.platform;
        const arch = process.arch;
        let assetPattern;
        switch (platform) {
            case 'darwin':
                // Map amd64 to x64 to match the actual asset names
                assetPattern = arch === 'arm64' ? 'opencode-darwin-arm64' : 'opencode-darwin-x64';
                break;
            case 'linux':
                // Map amd64 to x64 to match the actual asset names
                assetPattern = arch === 'arm64' ? 'opencode-linux-arm64' : 'opencode-linux-x64';
                break;
            case 'win32':
                assetPattern = 'opencode-windows-x64';
                break;
            default:
                console.warn(`[OpenCodeService] Unsupported platform: ${platform}`);
                return undefined;
        }
        // Find the asset that matches our pattern (looking for .zip files)
        const asset = release.assets.find((a) => a.name === `${assetPattern}.zip`);
        return asset?.name;
    }
    async getVersionFromBinary(binaryPath) {
        try {
            // OpenCode uses standard --version flag
            const { stdout } = await execAsync(`"${binaryPath}" --version`);
            // Parse version from output like "opencode version 0.4.0"
            const match = stdout.match(/v?(\d+\.\d+\.\d+)/);
            return match ? match[1] : null;
        }
        catch (error) {
            console.error('[OpenCodeService] Error getting version:', error);
            return null;
        }
    }
    async isOurVersion(installPath) {
        try {
            // Check if it's a symlink pointing to our managed directory
            const stats = await fs.lstat(installPath);
            if (stats.isSymbolicLink()) {
                const _target = await fs.readlink(installPath);
                const realPath = await fs.realpath(installPath);
                // Check if the real path is within our managed installation directory
                const userData = app.getPath('userData');
                const ourInstallPath = path.join(userData, CUSTOM_INSTALL_DIRECTORY, this.agentType);
                return realPath.startsWith(ourInstallPath);
            }
            // If it's not a symlink, check if the file itself is in our managed directory
            const realPath = await fs.realpath(installPath).catch(() => installPath);
            const userData = app.getPath('userData');
            const ourInstallPath = path.join(userData, CUSTOM_INSTALL_DIRECTORY, this.agentType);
            return realPath.startsWith(ourInstallPath);
        }
        catch {
            return false;
        }
    }
    async postInstallSetup(versionPath, _version) {
        // OpenCode releases are in .zip format
        // The downloaded file might be named as the binary but is actually a zip
        const binaryPath = path.join(versionPath, this.binaryName);
        try {
            // Check if the binary file is actually a zip archive
            const fileType = await execAsync(`file "${binaryPath}"`);
            if (fileType.stdout.includes('Zip archive')) {
                console.log('[OpenCodeService] Downloaded file is a zip archive, extracting...');
                // Rename to .zip temporarily for extraction
                const zipPath = `${binaryPath}.zip`;
                await fs.rename(binaryPath, zipPath);
                // Extract the zip file
                await execAsync(`unzip -o "${zipPath}" -d "${versionPath}"`);
                // Remove the zip file after extraction
                await fs.unlink(zipPath);
                // Find the actual binary in the extracted files
                const extractedFiles = await fs.readdir(versionPath);
                const actualBinary = extractedFiles.find(f => f.startsWith('opencode') && !f.endsWith('.zip') && f !== this.binaryName);
                if (actualBinary) {
                    // If we found a different binary file, ensure it's named correctly
                    if (actualBinary !== this.binaryName) {
                        await fs.rename(path.join(versionPath, actualBinary), path.join(versionPath, this.binaryName));
                    }
                }
                // Ensure the binary is executable
                await fs.chmod(binaryPath, 0o755);
            }
        }
        catch (error) {
            console.error('[OpenCodeService] Error in post-install setup:', error);
            throw error;
        }
    }
    async cleanAgentSpecificConfigs() {
        // Clean up OpenCode-specific configuration
        const agentConfigService = AgentConfigurationService.getInstance();
        try {
            await agentConfigService.removeHooksFromConfig(SupportedAgent.OPENCODE);
        }
        catch (error) {
            const err = error;
            if (err.code !== 'ENOENT') {
                console.warn('Could not clean up OpenCode settings:', error);
            }
        }
    }
    // OpenCode-specific public methods (implementing the interface)
    async installOpenCode(version) {
        return this.install(version);
    }
    async uninstallOpenCode() {
        return this.uninstall();
    }
    async updateOpenCode() {
        return this.update();
    }
    async isOurOpenCodeVersion(installPath) {
        return this.isOurVersion(installPath);
    }
    async getOpenCodeConfig() {
        try {
            // Use the settings path from agent info
            const configPath = this.expandHomePath(this.agentInfo.settingsPath || '~/.config/openCode/openCode.json');
            const content = await fs.readFile(configPath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return {};
        }
    }
    expandHomePath(filePath) {
        if (filePath.startsWith('~/')) {
            return path.join(os.homedir(), filePath.slice(2));
        }
        return filePath;
    }
    async updateOpenCodeConfig(newConfig) {
        const configPath = this.expandHomePath(this.agentInfo.settingsPath || '~/.config/openCode/openCode.json');
        const configDir = path.dirname(configPath);
        await fs.mkdir(configDir, { recursive: true });
        let finalConfig = newConfig;
        try {
            const existingConfig = await this.getOpenCodeConfig();
            if (Object.keys(existingConfig).length > 0) {
                finalConfig = this.deepMerge(existingConfig, newConfig);
            }
        }
        catch (error) {
            console.error('Could not merge existing opencode config, overwriting.', error);
        }
        await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
    }
    async testOpenCodeConnection() {
        try {
            // OpenCode might have a different test command or health check
            const { stdout: _stdout } = await execAsync(`${this.binaryName} --help`);
            return {
                success: true,
                message: 'OpenCode is installed and accessible',
            };
        }
        catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }
    isObject(item) {
        return Boolean(item && typeof item === 'object' && !Array.isArray(item));
    }
    deepMerge(target, source) {
        const output = { ...target };
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach((key) => {
                if (key === 'hooks' &&
                    Array.isArray(source[key]) &&
                    Array.isArray(target[key])) {
                    const targetHooks = target[key];
                    const sourceHooks = source[key];
                    const mergedHooks = [...targetHooks];
                    sourceHooks.forEach((sourceHook) => {
                        const existingHookIndex = mergedHooks.findIndex((h) => h.id === sourceHook.id);
                        if (existingHookIndex !== -1) {
                            mergedHooks[existingHookIndex] = {
                                ...mergedHooks[existingHookIndex],
                                ...sourceHook,
                            };
                        }
                        else {
                            mergedHooks.push(sourceHook);
                        }
                    });
                    output[key] = mergedHooks;
                }
                else if (this.isObject(source[key]) &&
                    key in target &&
                    this.isObject(target[key])) {
                    output[key] = this.deepMerge(target[key], source[key]);
                }
                else {
                    output[key] = source[key];
                }
            });
        }
        return output;
    }
}

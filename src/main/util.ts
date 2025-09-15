/* eslint import/prefer-default-export: off */
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

import { getAgentInfo, SUPPORTED_AGENTS } from "@principal-ai/agent-monitoring";
import { APP_BRANDING } from '../shared/config/appBranding';
import { EnvironmentConfig } from './utils/environmentConfig';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}



const REQUIRED_HOOK_ASSETS: string[] = [
  APP_BRANDING.MCP_SERVER_FILENAME
];
SUPPORTED_AGENTS.forEach((agent) => {
  REQUIRED_HOOK_ASSETS.push(getAgentInfo(agent).hookPath);
});

// Verify all required assets exist
export const verifyRequiredAssets = (): { success: boolean; missing: string[] } => {
  const missing: string[] = [];
  
  for (const asset of REQUIRED_HOOK_ASSETS) {
    const assetPath = EnvironmentConfig.getAssetsPath(asset);
    try {
      if (!fs.existsSync(assetPath)) {
        missing.push(asset);
        console.error(`[Asset Verification] Missing required asset: ${assetPath}`);
      } else {
        console.log(`[Asset Verification] Verified asset: ${assetPath}`);
      }
    } catch (error) {
      missing.push(asset);
      console.error(`[Asset Verification] Error checking asset ${asset}:`, error);
    }
  }
  
  const success = missing.length === 0;
  if (success) {
    console.log('[Asset Verification] All required assets verified successfully');
  } else {
    console.error(`[Asset Verification] Missing ${missing.length} required assets:`, missing);
  }
  
  return { success, missing };
};



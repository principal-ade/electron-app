import { HookConfigurationManager } from './HookConfigurationManager';
import { HookConfigurationManagerV2 } from './HookConfigurationManagerV2';

// Feature flag to switch between V1 and V2
const USE_V2_HOOK_MANAGER = process.env.USE_V2_HOOKS === 'true' || true; // Default to V2 for testing

/**
 * Factory to get the appropriate hook manager instance
 */
export function getHookManager() {
  if (USE_V2_HOOK_MANAGER) {
    console.log('[HookManagerFactory] Using V2 hook manager with @a24z/agent-manager');
    return HookConfigurationManagerV2.getInstance();
  } else {
    console.log('[HookManagerFactory] Using V1 hook manager');
    return HookConfigurationManager.getInstance();
  }
}
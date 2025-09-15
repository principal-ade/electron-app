#!/usr/bin/env node
/**
 * OpenCode Hook - Zero Config
 */
import { SupportedAgent } from '../../agents';
import { MinimalHook } from '../core/minimal-hook';
const agent = SupportedAgent.OPENCODE;
const hook = new MinimalHook(agent);
hook.run();
//# sourceMappingURL=opencode-hook-minimal.js.map
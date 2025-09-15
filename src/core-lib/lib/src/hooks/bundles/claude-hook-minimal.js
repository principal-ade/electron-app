#!/usr/bin/env node
/**
 * Claude Hook - Zero Config
 */
import { SupportedAgent } from '../../agents';
import { MinimalHook } from '../core/minimal-hook';
const agent = SupportedAgent.CLAUDE;
const hook = new MinimalHook(agent);
hook.run();
//# sourceMappingURL=claude-hook-minimal.js.map
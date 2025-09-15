#!/usr/bin/env node
/**
 * Gemini Hook - Zero Config
 */
import { SupportedAgent } from '../../agents';
import { MinimalHook } from '../core/minimal-hook';
const agent = SupportedAgent.GEMINI;
const hook = new MinimalHook(agent);
hook.run();
//# sourceMappingURL=gemini-hook-minimal.js.map
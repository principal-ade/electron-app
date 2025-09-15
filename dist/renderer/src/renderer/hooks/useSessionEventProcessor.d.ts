/**
 * React hook for processing session events in the UI
 */
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
import { ProcessingResult } from '../../shared/event-processing/SessionEventProcessor';
import { EnhancedUIAgentSessionData } from '../types/session.types';
export interface UseSessionEventProcessorOptions {
    onSessionUpdate?: (sessionId: string, updates: Partial<EnhancedUIAgentSessionData>) => void;
    onSideEffect?: (sessionId: string, effects: ProcessingResult['sideEffects']) => void;
}
export declare function useSessionEventProcessor(options: UseSessionEventProcessorOptions): {
    processEvent: (event: NormalizedAgentSessionEvent, currentSession?: EnhancedUIAgentSessionData) => void;
    resetSession: (sessionId: string) => void;
    clearCache: () => void;
};
//# sourceMappingURL=useSessionEventProcessor.d.ts.map
export type { SessionStatistics, SessionViewResult } from '../../../shared/main-process-api-interfaces/SessionViewAPI';
export type { SessionView, SessionSegment } from '../../../shared/sessionViewTypes';
/**
 * Session View API for renderer process
 * @deprecated Use SessionViewService directly instead
 */
export declare class SessionViewAPI {
    /**
     * Get a complete session view with segments
     * @deprecated Use SessionViewService.getSessionView instead
     */
    static getSessionView(sessionId: string): Promise<import("./SessionViewAPI").SessionViewResult<import("./SessionViewAPI").SessionView>>;
    /**
     * Get details for a specific segment
     * @deprecated Use SessionViewService.getSegment instead
     */
    static getSegment(sessionId: string, segmentId: string): Promise<import("./SessionViewAPI").SessionViewResult<import("./SessionViewAPI").SessionSegment>>;
    /**
     * Get session statistics
     * @deprecated Use SessionViewService.getStatistics instead
     */
    static getStatistics(sessionId: string): Promise<import("./SessionViewAPI").SessionViewResult<import("./SessionViewAPI").SessionStatistics>>;
}
//# sourceMappingURL=SessionViewAPI.d.ts.map
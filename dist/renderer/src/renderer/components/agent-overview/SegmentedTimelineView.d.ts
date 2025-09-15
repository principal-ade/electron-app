import React from 'react';
import type { AgentSessionRecord } from '../../../shared/sessionTypes';
interface SegmentedTimelineViewProps {
    session: AgentSessionRecord;
    newEventIds: Set<string>;
    segmentEventsByStops: (session: AgentSessionRecord) => any[];
}
export declare const SegmentedTimelineView: React.FC<SegmentedTimelineViewProps>;
export {};
//# sourceMappingURL=SegmentedTimelineView.d.ts.map
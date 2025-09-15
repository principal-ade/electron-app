import React from 'react';
import { SessionEventType } from '../../../shared/sessionEnums';
interface AnimatedTimelineEventProps {
    event: {
        type: SessionEventType;
        timestamp: number;
        data: any;
    };
    isNew?: boolean;
    isSelected?: boolean;
    renderContent: (event: any, timeStr: string) => React.ReactNode;
}
export declare const AnimatedTimelineEvent: React.NamedExoticComponent<AnimatedTimelineEventProps>;
export {};
//# sourceMappingURL=AnimatedTimelineEvent.d.ts.map
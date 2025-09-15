import React from 'react';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
interface GroupedEvent {
    id: string;
    type: 'single' | 'paired';
    preEvent?: NormalizedAgentSessionEvent;
    postEvent?: NormalizedAgentSessionEvent;
    event?: NormalizedAgentSessionEvent;
    timestamp: number;
    toolName: string;
    fileCount: number;
    files: string[];
    duration?: number;
}
interface EventCarouselProps {
    events: NormalizedAgentSessionEvent[];
    onEventSelect: (event: GroupedEvent, files: string[]) => void;
    onHighlightModeChange?: (mode: 'single' | 'trail' | 'cumulative') => void;
    className?: string;
}
export declare const EventCarousel: React.FC<EventCarouselProps>;
export default EventCarousel;
//# sourceMappingURL=EventCarousel.d.ts.map
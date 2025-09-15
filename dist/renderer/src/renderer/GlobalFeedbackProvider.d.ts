import React from 'react';
interface FeedbackContextValue {
    showFeedback: (componentInfo: any) => void;
}
export declare const useFeedback: () => FeedbackContextValue;
interface GlobalFeedbackProviderProps {
    children: React.ReactNode;
}
export declare const GlobalFeedbackProvider: React.FC<GlobalFeedbackProviderProps>;
export {};
//# sourceMappingURL=GlobalFeedbackProvider.d.ts.map
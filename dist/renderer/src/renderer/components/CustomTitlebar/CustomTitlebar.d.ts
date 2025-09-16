import React from 'react';
import './CustomTitlebar.css';
declare global {
    interface Window {
        electronTitlebar?: {
            minimize: () => void;
            maximize: () => void;
            close: () => void;
            isMaximized: () => Promise<boolean>;
            onMaximizeChange: (callback: (isMaximized: boolean) => void) => void;
        };
    }
}
interface CustomTitlebarProps {
    onSettingsClick?: () => void;
    hasUpdateAvailable?: boolean;
}
export declare const CustomTitlebar: React.FC<CustomTitlebarProps>;
export declare const SimpleCustomTitlebar: React.FC<CustomTitlebarProps>;
export {};
//# sourceMappingURL=CustomTitlebar.d.ts.map
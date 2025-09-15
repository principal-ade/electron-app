import React from 'react';
export type RepositoryMode = 'explore' | 'develop' | 'planning' | 'maintain';
interface ModeSwitchProps {
    mode: RepositoryMode;
    onModeChange?: (mode: RepositoryMode) => void;
    hasLocalClones: boolean;
    disabled?: boolean;
}
export declare const ModeSwitch: React.FC<ModeSwitchProps>;
export {};
//# sourceMappingURL=ModeSwitch.d.ts.map
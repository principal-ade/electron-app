import React from 'react';
import type { RepositoryViewType } from '../../../../shared/types/userPreferences.types';
export type RepositoryMode = RepositoryViewType;
interface ModeSelectorProps {
    mode: RepositoryMode;
    onModeChange?: (mode: RepositoryMode) => void;
    hasLocalClones?: boolean;
    disabled?: boolean;
}
export declare const ModeSelector: React.FC<ModeSelectorProps>;
export {};
//# sourceMappingURL=ModeSelector.d.ts.map
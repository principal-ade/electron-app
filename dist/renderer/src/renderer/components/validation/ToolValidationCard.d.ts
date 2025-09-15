import React from 'react';
import { PackageValidation, ValidationTemplate, ActionCategory } from '../../../shared/tool-validation-types';
interface ToolValidationCardProps {
    validation: PackageValidation;
    template: ValidationTemplate;
    isRunning: boolean;
    selectedCategory?: ActionCategory;
    onRun: (actionIds?: string[]) => void;
    isConfigured?: boolean;
    onToggleConfiguration?: (enabled: boolean) => void;
    showConfiguration?: boolean;
}
export declare const ToolValidationCard: React.FC<ToolValidationCardProps>;
export {};
//# sourceMappingURL=ToolValidationCard.d.ts.map
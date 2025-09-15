import React from 'react';
import { ValidationResult } from '../../../shared/tool-validation-types';
interface ToolValidationResultsProps {
    results: {
        validationId: string;
        templateName: string;
        results: ValidationResult[];
    };
    onClose: () => void;
}
export declare const ToolValidationResults: React.FC<ToolValidationResultsProps>;
export {};
//# sourceMappingURL=ToolValidationResults.d.ts.map
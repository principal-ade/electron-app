import React from 'react';
import { PackageValidation } from '../../../shared/tool-validation-types';
interface ValidationCategoryViewProps {
    validations: PackageValidation[];
    workingDirectory?: string;
    onAddValidation: (validation: PackageValidation) => void;
    onCancel: () => void;
}
export declare const ValidationCategoryView: React.FC<ValidationCategoryViewProps>;
export {};
//# sourceMappingURL=ValidationCategoryView.d.ts.map
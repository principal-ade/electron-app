/**
 * Built-in validation templates for common tools
 */
import { ValidationTemplate } from '../../../../shared/tool-validation-types';
export declare const builtInTemplates: ValidationTemplate[];
export declare const templateRegistry: Map<string, ValidationTemplate>;
export declare function getTemplate(templateId: string): ValidationTemplate | undefined;
export declare function getTemplatesByTool(toolName: string): ValidationTemplate[];
export declare function getTemplatesByType(toolType: string): ValidationTemplate[];
export * from './eslint-template';
export * from './typescript-template';
export * from './jest-template';
export * from './prettier-template';
export * from './vitest-template';
export * from './react-template';
export * from './nextjs-template';
export * from './electron-template';
export * from './storybook-template';
//# sourceMappingURL=index.d.ts.map
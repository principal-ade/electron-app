/**
 * Built-in validation templates for common tools
 */
import { eslintTemplate } from './eslint-template';
import { typescriptTemplate } from './typescript-template';
import { jestTemplate } from './jest-template';
import { prettierTemplate } from './prettier-template';
import { vitestTemplate } from './vitest-template';
import { reactTemplate } from './react-template';
import { nextjsTemplate } from './nextjs-template';
import { electronTemplate } from './electron-template';
import { storybookTemplate } from './storybook-template';
// Registry of all built-in templates
export const builtInTemplates = [
    eslintTemplate,
    typescriptTemplate,
    jestTemplate,
    prettierTemplate,
    vitestTemplate,
    reactTemplate,
    nextjsTemplate,
    electronTemplate,
    storybookTemplate,
];
// Template registry for quick lookup
export const templateRegistry = new Map(builtInTemplates.map((template) => [template.id, template]));
// Get template by ID
export function getTemplate(templateId) {
    return templateRegistry.get(templateId);
}
// Get templates by tool name
export function getTemplatesByTool(toolName) {
    return builtInTemplates.filter((template) => template.tool.name.toLowerCase() === toolName.toLowerCase());
}
// Get templates by tool type
export function getTemplatesByType(toolType) {
    return builtInTemplates.filter((template) => template.tool.type === toolType);
}
// Export individual templates
export * from './eslint-template';
export * from './typescript-template';
export * from './jest-template';
export * from './prettier-template';
export * from './vitest-template';
export * from './react-template';
export * from './nextjs-template';
export * from './electron-template';
export * from './storybook-template';

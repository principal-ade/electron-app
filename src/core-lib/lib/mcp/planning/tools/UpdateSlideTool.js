"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSlideTool = void 0;
const zod_1 = require("zod");
const PlanningBaseTool_1 = require("./PlanningBaseTool");
class UpdateSlideTool extends PlanningBaseTool_1.PlanningBaseTool {
    constructor() {
        super(...arguments);
        this.name = 'planning_updateSlide';
        this.description = 'Update the content of a specific slide in the planning document';
        this.schema = zod_1.z.object({
            filePath: zod_1.z.string().describe('The path to the planning document'),
            slideNumber: zod_1.z.number().describe('The slide number to update (0-indexed)'),
            content: zod_1.z.string().describe('The new content for the slide'),
            autoSave: zod_1.z
                .boolean()
                .optional()
                .default(false)
                .describe('Whether to save the document after updating'),
        });
    }
    async execute(input) {
        const { filePath, slideNumber, content, autoSave } = input;
        try {
            const response = await this.makeRequest('/slide/update', {
                filePath,
                slideNumber,
                content,
                autoSave,
            });
            if (response.success) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Successfully updated slide ${slideNumber + 1}${autoSave ? ' and saved document' : ''}`,
                            data: response,
                        },
                    ],
                };
            }
            else {
                return this.createErrorResponse(String(response.error) || 'Failed to update slide');
            }
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to update slide');
        }
    }
}
exports.UpdateSlideTool = UpdateSlideTool;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSlideTool = void 0;
const zod_1 = require("zod");
const PlanningBaseTool_1 = require("./PlanningBaseTool");
class CreateSlideTool extends PlanningBaseTool_1.PlanningBaseTool {
    constructor() {
        super(...arguments);
        this.name = 'planning_createSlide';
        this.description = 'Create a new slide in the planning document';
        this.schema = zod_1.z.object({
            filePath: zod_1.z.string().describe('The path to the planning document'),
            position: zod_1.z
                .enum(['before', 'after', 'end'])
                .describe('Where to insert the new slide relative to current slide'),
            content: zod_1.z
                .string()
                .optional()
                .default('# New Slide\n\nContent here...')
                .describe('The content for the new slide'),
            autoSave: zod_1.z
                .boolean()
                .optional()
                .default(false)
                .describe('Whether to save the document after creating'),
        });
    }
    async execute(input) {
        const { filePath, position, content, autoSave } = input;
        try {
            const response = await this.makeRequest('/slide/create', {
                filePath,
                position,
                content,
                autoSave,
            });
            if (response.success) {
                const slideNumber = response.slideNumber;
                const totalSlides = response.totalSlides;
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Created new slide at position ${slideNumber + 1}. Total slides: ${totalSlides}`,
                            data: response,
                        },
                    ],
                };
            }
            else {
                return this.createErrorResponse(String(response.error) || 'Failed to create slide');
            }
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to create slide');
        }
    }
}
exports.CreateSlideTool = CreateSlideTool;

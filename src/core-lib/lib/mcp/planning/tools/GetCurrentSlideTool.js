"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCurrentSlideTool = void 0;
const zod_1 = require("zod");
const PlanningBaseTool_1 = require("./PlanningBaseTool");
class GetCurrentSlideTool extends PlanningBaseTool_1.PlanningBaseTool {
    constructor() {
        super(...arguments);
        this.name = 'planning_getCurrentSlide';
        this.description = 'Get the current slide in the planning document';
        this.schema = zod_1.z.object({
            filePath: zod_1.z.string().describe('The path to the planning document'),
        });
    }
    async execute(input) {
        const { filePath } = input;
        try {
            const response = await this.makeRequest('/slide/current', { filePath });
            if (response.success) {
                const slideNumber = response.slideNumber;
                const totalSlides = response.totalSlides;
                const content = response.content;
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Slide ${slideNumber + 1} of ${totalSlides}:\n\n${content}`,
                            data: response,
                        },
                    ],
                };
            }
            else {
                return this.createErrorResponse(String(response.error) || 'Failed to get current slide');
            }
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to get current slide');
        }
    }
}
exports.GetCurrentSlideTool = GetCurrentSlideTool;

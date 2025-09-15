"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavigateToSlideTool = void 0;
const zod_1 = require("zod");
const PlanningBaseTool_1 = require("./PlanningBaseTool");
class NavigateToSlideTool extends PlanningBaseTool_1.PlanningBaseTool {
    constructor() {
        super(...arguments);
        this.name = 'planning_navigateToSlide';
        this.description = 'Navigate to a specific slide number in the planning document';
        this.schema = zod_1.z.object({
            filePath: zod_1.z.string().describe('The path to the planning document'),
            slideNumber: zod_1.z.number().describe('The slide number to navigate to (0-indexed)'),
        });
    }
    async execute(input) {
        const { filePath, slideNumber } = input;
        try {
            const response = await this.makeRequest('/slide/navigate', { filePath, slideNumber });
            if (response.success) {
                const currentSlide = response.currentSlide;
                const content = response.content;
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Navigated to slide ${currentSlide + 1}:\n\n${content}`,
                            data: response,
                        },
                    ],
                };
            }
            else {
                return this.createErrorResponse(String(response.error) || 'Failed to navigate to slide');
            }
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to navigate to slide');
        }
    }
}
exports.NavigateToSlideTool = NavigateToSlideTool;

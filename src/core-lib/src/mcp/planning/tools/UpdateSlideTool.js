import { z } from 'zod';
import { PlanningBaseTool } from './PlanningBaseTool';
export class UpdateSlideTool extends PlanningBaseTool {
    constructor() {
        super(...arguments);
        this.name = 'planning_updateSlide';
        this.description = 'Update the content of a specific slide in the planning document';
        this.schema = z.object({
            filePath: z.string().describe('The path to the planning document'),
            slideNumber: z.number().describe('The slide number to update (0-indexed)'),
            content: z.string().describe('The new content for the slide'),
            autoSave: z
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

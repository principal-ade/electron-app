"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartPlanningTool = void 0;
const zod_1 = require("zod");
const PlanningBaseTool_1 = require("./PlanningBaseTool");
class StartPlanningTool extends PlanningBaseTool_1.PlanningBaseTool {
    constructor() {
        super(...arguments);
        this.name = 'start_planning';
        this.description = 'Start a planning session. Shows a UI for the user to select an existing planning document or create a new one.';
        this.schema = zod_1.z.object({
            agentName: zod_1.z.string().describe('The name of the agent requesting to open a document'),
            suggestedTitle: zod_1.z.string().optional().describe('Optional suggested title for a new document'),
            suggestedType: zod_1.z
                .enum(['markdown', 'excalidraw'])
                .optional()
                .describe('Optional suggested document type'),
            message: zod_1.z.string().optional().describe('Optional message to show to the user'),
        });
    }
    async execute(input) {
        const { agentName, suggestedTitle, suggestedType, message } = input;
        try {
            const response = await this.makeRequest('/document/open', {
                agentName,
                suggestedTitle,
                suggestedType,
                message,
            });
            if (response.success) {
                if (response.documentSelected) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Document opened: ${response.documentTitle}\nType: ${response.documentType}\nPath: ${response.filePath || 'In-memory'}`,
                                data: response,
                            },
                        ],
                    };
                }
                else {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'User cancelled document selection',
                                data: { cancelled: true },
                            },
                        ],
                    };
                }
            }
            else {
                return this.createErrorResponse(String(response.error) || 'Failed to open document');
            }
        }
        catch (error) {
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to open document');
        }
    }
}
exports.StartPlanningTool = StartPlanningTool;

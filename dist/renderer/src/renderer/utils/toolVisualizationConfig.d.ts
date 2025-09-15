import type { LayerRenderStrategy } from "@principal-ai/code-city-react";
export interface ToolVisualization {
    icon: string;
    color: string;
    renderStrategy: LayerRenderStrategy;
    name: string;
}
export declare const TOOL_VISUALIZATIONS: Record<string, ToolVisualization>;
export declare function getToolVisualization(toolName: string): ToolVisualization;
//# sourceMappingURL=toolVisualizationConfig.d.ts.map
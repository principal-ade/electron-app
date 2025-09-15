import { Flow } from '../core/flow';
import { GraphData, NodeId } from '../types';
export interface GraphDataProvider {
    getGraphData(): GraphData;
}
export declare class GraphVisualizationHelper {
    static generateMermaidDiagram(graphData: GraphData): string;
    static generateDotDiagram(graphData: GraphData): string;
    static generateJSON(graphData: GraphData): string;
    static analyzeGraph(graphData: GraphData): {
        nodeCount: number;
        edgeCount: number;
        startNodes: NodeId[];
        endNodes: NodeId[];
        isolatedNodes: NodeId[];
        hasCycles: boolean;
    };
    private static detectCycles;
}
export declare function exportFlowAsGraph(flow: Flow, format?: 'mermaid' | 'dot' | 'json'): string;
//# sourceMappingURL=graph-mixin.d.ts.map
export class GraphVisualizationHelper {
    static generateMermaidDiagram(graphData) {
        const lines = ['graph TD'];
        for (const node of graphData.nodes) {
            const shape = node.type === 'subflow' ? '[[' : '[';
            const endShape = node.type === 'subflow' ? ']]' : ']';
            const label = node.label.replace(/"/g, '\\"');
            lines.push(`    ${node.id}${shape}"${label}"${endShape}`);
        }
        for (const edge of graphData.edges) {
            const label = edge.label || '';
            const arrow = edge.condition ? '-.->|' + label + '|' : '-->|' + label + '|';
            lines.push(`    ${edge.source} ${arrow} ${edge.target}`);
        }
        return lines.join('\n');
    }
    static generateDotDiagram(graphData) {
        const lines = ['digraph Flow {'];
        lines.push('    rankdir=TB;');
        lines.push('    node [shape=box, style=rounded];');
        for (const node of graphData.nodes) {
            const label = node.label.replace(/"/g, '\\"');
            const shape = node.type === 'subflow' ? 'box3d' : 'box';
            lines.push(`    "${node.id}" [label="${label}", shape=${shape}];`);
        }
        for (const edge of graphData.edges) {
            const style = edge.condition ? 'dashed' : 'solid';
            const label = edge.label ? `, label="${edge.label}"` : '';
            lines.push(`    "${edge.source}" -> "${edge.target}" [style=${style}${label}];`);
        }
        lines.push('}');
        return lines.join('\n');
    }
    static generateJSON(graphData) {
        return JSON.stringify(graphData, null, 2);
    }
    static analyzeGraph(graphData) {
        const { nodes, edges } = graphData;
        const incomingEdges = new Map();
        const outgoingEdges = new Map();
        for (const node of nodes) {
            incomingEdges.set(node.id, 0);
            outgoingEdges.set(node.id, 0);
        }
        for (const edge of edges) {
            incomingEdges.set(edge.target, (incomingEdges.get(edge.target) || 0) + 1);
            outgoingEdges.set(edge.source, (outgoingEdges.get(edge.source) || 0) + 1);
        }
        const startNodes = nodes
            .filter(n => incomingEdges.get(n.id) === 0 && outgoingEdges.get(n.id) > 0)
            .map(n => n.id);
        const endNodes = nodes
            .filter(n => outgoingEdges.get(n.id) === 0 && incomingEdges.get(n.id) > 0)
            .map(n => n.id);
        const isolatedNodes = nodes
            .filter(n => incomingEdges.get(n.id) === 0 && outgoingEdges.get(n.id) === 0)
            .map(n => n.id);
        const hasCycles = this.detectCycles(graphData);
        return {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            startNodes,
            endNodes,
            isolatedNodes,
            hasCycles,
        };
    }
    static detectCycles(graphData) {
        const adjacencyList = new Map();
        for (const node of graphData.nodes) {
            adjacencyList.set(node.id, []);
        }
        for (const edge of graphData.edges) {
            adjacencyList.get(edge.source).push(edge.target);
        }
        const visited = new Set();
        const recursionStack = new Set();
        const dfs = (nodeId) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            for (const neighbor of adjacencyList.get(nodeId) || []) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor))
                        return true;
                }
                else if (recursionStack.has(neighbor)) {
                    return true;
                }
            }
            recursionStack.delete(nodeId);
            return false;
        };
        for (const node of graphData.nodes) {
            if (!visited.has(node.id)) {
                if (dfs(node.id))
                    return true;
            }
        }
        return false;
    }
}
export function exportFlowAsGraph(flow, format = 'json') {
    const graphData = flow.getGraphData();
    switch (format) {
        case 'mermaid':
            return GraphVisualizationHelper.generateMermaidDiagram(graphData);
        case 'dot':
            return GraphVisualizationHelper.generateDotDiagram(graphData);
        case 'json':
        default:
            return GraphVisualizationHelper.generateJSON(graphData);
    }
}

import { jsx as _jsx } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from 'react';
import { AnimatedResizableLayout } from "@a24z/panels";
import "@a24z/panels/style.css";
import { ExcalidrawWrapper } from './shared/ExcalidrawWrapper';
import { DiagramBrowser, } from '../../components/LocalSessionWorkspace/WorkspaceSidebar/DiagramBrowser';
import { ExcalidrawStorageService } from '../../main-process-api/ExcalidrawStorageService';
import { diagramEventBus, DIAGRAM_EVENTS } from '../../services/DiagramEventBus';
export const DiagramWorkspace = ({ projectPath, defaultCollapsed = false, onDiagramChange, }) => {
    const [currentDiagramId, setCurrentDiagramId] = useState(null);
    const [currentDiagramData, setCurrentDiagramData] = useState(null);
    const [currentDiagramName, setCurrentDiagramName] = useState('Untitled Diagram');
    const browserRef = useRef(null);
    // Load diagram data when ID changes
    const loadDiagram = useCallback(async (diagramId) => {
        try {
            const diagram = await ExcalidrawStorageService.loadDiagram(diagramId);
            if (diagram) {
                setCurrentDiagramData(diagram.data);
                setCurrentDiagramName(diagram.name);
                setCurrentDiagramId(diagramId);
                onDiagramChange?.(diagramId);
            }
        }
        catch (error) {
            console.error('Failed to load diagram:', error);
        }
    }, [onDiagramChange]);
    // Handle diagram selection from browser
    const handleDiagramSelect = useCallback((diagramId) => {
        loadDiagram(diagramId);
    }, [loadDiagram]);
    // Handle creating a new diagram
    const handleCreateNew = useCallback(() => {
        setCurrentDiagramId(null);
        setCurrentDiagramData(null);
        setCurrentDiagramName('Untitled Diagram');
        onDiagramChange?.(null);
    }, [onDiagramChange]);
    // Handle save event from ExcalidrawWrapper
    const handleSave = useCallback((diagramId) => {
        if (!currentDiagramId) {
            // New diagram was saved, update our state
            setCurrentDiagramId(diagramId);
            onDiagramChange?.(diagramId);
        }
    }, [currentDiagramId, onDiagramChange]);
    // Listen for diagram events to refresh the browser
    useEffect(() => {
        const handleDiagramCreated = () => {
            browserRef.current?.refresh();
        };
        const handleDiagramSaved = () => {
            browserRef.current?.refresh();
        };
        diagramEventBus.on(DIAGRAM_EVENTS.DIAGRAM_CREATED, handleDiagramCreated);
        diagramEventBus.on(DIAGRAM_EVENTS.DIAGRAM_SAVED, handleDiagramSaved);
        return () => {
            diagramEventBus.off(DIAGRAM_EVENTS.DIAGRAM_CREATED, handleDiagramCreated);
            diagramEventBus.off(DIAGRAM_EVENTS.DIAGRAM_SAVED, handleDiagramSaved);
        };
    }, []);
    const leftPanel = (_jsx(DiagramBrowser, { ref: browserRef, currentProjectPath: projectPath, onDiagramSelect: handleDiagramSelect, onCreateNew: handleCreateNew, currentDiagramId: currentDiagramId }));
    const rightPanel = (_jsx(ExcalidrawWrapper, { diagramId: currentDiagramId || undefined, diagramName: currentDiagramName, initialData: currentDiagramData || undefined, projectPath: projectPath, onSave: handleSave, onClose: handleCreateNew }));
    return (_jsx(AnimatedResizableLayout, { leftPanel: leftPanel, rightPanel: rightPanel, collapsibleSide: "left", defaultSize: 25, minSize: 15, collapsed: defaultCollapsed, showCollapseButton: true, className: "diagram-workspace", style: {
            height: '100%',
            width: '100%',
        } }));
};

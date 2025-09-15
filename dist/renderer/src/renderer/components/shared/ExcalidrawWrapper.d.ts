import React from 'react';
import { AppState as ExcalidrawAppState } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { ExcalidrawDiagramData } from '../../../../shared/main-process-api-interfaces/ExcalidrawAPI';
import { LibraryItem } from '@excalidraw/excalidraw/types';
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
interface ExcalidrawWrapperProps {
    onChange?: (elements: readonly OrderedExcalidrawElement[], appState: ExcalidrawAppState) => void;
    initialData?: ExcalidrawDiagramData;
    onClose?: () => void;
    libraryItems?: LibraryItem[];
    diagramId?: string;
    diagramName?: string;
    projectPath?: string;
    onSave?: (diagramId: string) => void;
    showSaveToRepository?: boolean;
    onSaveToRepository?: () => void;
    showSaveButton?: boolean;
    showNewDiagramButton?: boolean;
    showNameEditor?: boolean;
}
export declare const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps>;
export {};
//# sourceMappingURL=ExcalidrawWrapper.d.ts.map
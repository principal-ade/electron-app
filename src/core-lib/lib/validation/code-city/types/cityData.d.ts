import { ColorTheme, ColorFunction } from './themes';
export interface Position3D {
    x: number;
    y: number;
    z: number;
}
export interface Bounds3D {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}
export interface Bounds2D {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}
export interface CityBuilding {
    path: string;
    position: Position3D;
    dimensions: [number, number, number];
    color?: string;
    type: 'file';
    fileExtension?: string;
    size?: number;
    lastModified?: Date;
}
export interface CityDistrict {
    path: string;
    worldBounds: Bounds2D;
    fileCount: number;
    type: 'directory';
    children?: CityDistrict[];
    label?: {
        text: string;
        bounds: Bounds2D;
        position: 'top' | 'bottom';
    };
}
export interface CityData {
    buildings: CityBuilding[];
    districts: CityDistrict[];
    bounds: Bounds2D;
    metadata: {
        totalFiles: number;
        totalDirectories: number;
        analyzedAt: Date;
        rootPath: string;
        layoutConfig?: {
            paddingTop: number;
            paddingBottom: number;
            paddingLeft: number;
            paddingRight: number;
            paddingInner: number;
            paddingOuter: number;
        };
    };
}
export type DirectoryRenderMode = 'all' | 'filter' | 'focus' | 'drilldown';
export interface SelectiveRenderOptions {
    mode: DirectoryRenderMode;
    directories?: Set<string>;
    rootDirectory?: string;
    showParentContext?: boolean;
}
export interface ArchitectureMapProps {
    cityData?: CityData;
    theme?: ColorTheme;
    customColorFn?: ColorFunction;
    highlightedPaths?: Set<string>;
    selectedPaths?: Set<string>;
    focusDirectory?: string | null;
    rootDirectoryName?: string;
    onDirectorySelect?: (directory: string | null) => void;
    onFileClick?: (path: string, type: 'file' | 'directory') => void;
    fullSize?: boolean;
    showGrid?: boolean;
    showFileNames?: boolean;
    className?: string;
    selectiveRender?: SelectiveRenderOptions;
    changedFiles?: Map<string, 'added' | 'modified' | 'deleted' | 'renamed'>;
    showOnlyChangedFiles?: boolean;
    disableChangeColors?: boolean;
    highlightMode?: boolean;
    isolateMode?: boolean;
    canvasBackgroundColor?: string;
    tooltipPosition?: 'cursor' | 'corner';
    directoryTooltipCorner?: 'top-left' | 'bottom-left';
    disableAutoFit?: boolean;
    hoverBorderColor?: string;
    selectedBorderColor?: string;
    disableOpacityDimming?: boolean;
    defaultDirectoryColor?: string;
    showFileTypeIcons?: boolean;
    subdirectoryMode?: {
        enabled: boolean;
        rootPath?: string;
        filters?: Array<{
            path: string;
            mode: 'include' | 'exclude';
        }>;
        showRootPath?: boolean;
        autoCenter?: boolean;
        resetZoomOnCenter?: boolean;
        animateTransitions?: boolean;
        combineMode?: 'union' | 'intersection';
    };
    importanceConfig?: import('./importanceTypes').ImportanceConfig;
    showImportanceLabels?: boolean;
}
export interface MapInteractionState {
    hoveredDistrict: CityDistrict | null;
    hoveredBuilding: CityBuilding | null;
    mousePos: {
        x: number;
        y: number;
    };
    tooltip: {
        x: number;
        y: number;
        text: string;
        isCorner?: boolean;
    } | null;
    directoryTooltip: {
        text: string;
        corner: 'top-left' | 'bottom-left';
    } | null;
}
export interface MapDisplayOptions {
    showGrid: boolean;
    showConnections: boolean;
    maxConnections: number;
    gridSize: number;
    padding: number;
}
export interface FileChange {
    path: string;
    changeType: 'added' | 'modified' | 'deleted' | 'renamed';
    linesAdded: number;
    linesDeleted: number;
    oldPath?: string;
}
export interface Commit {
    sha: string;
    message: string;
    author: string;
    timestamp: Date;
    changedFiles: FileChange[];
}
export interface PRVisualizationData {
    prNumber: number;
    title: string;
    author: string;
    commits: Commit[];
    totalChangedFiles: number;
    totalLinesAdded: number;
    totalLinesDeleted: number;
}
export interface PRVisualizationProps extends ArchitectureMapProps {
    prData?: PRVisualizationData;
    currentCommitIndex?: number;
    showCumulativeChanges?: boolean;
    animationSpeed?: number;
    onCommitChange?: (index: number) => void;
    onPlayStateChange?: (isPlaying: boolean) => void;
}

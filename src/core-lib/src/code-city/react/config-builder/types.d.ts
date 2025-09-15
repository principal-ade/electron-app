export interface GridGroup {
    id: string;
    name: string;
    files: string[];
    position: {
        row: number;
        col: number;
    } | null;
    color: string;
}
export interface GridSize {
    rows: number;
    cols: number;
}
export type WorkflowStep = 'idle' | 'selecting' | 'naming' | 'positioning' | 'editing';
export interface CurrentGroup {
    name: string;
    files: string[];
}
export interface RootItem {
    name: string;
    path: string;
    type: 'directory' | 'file';
    size: number;
    isGrouped: boolean;
}
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { CodebaseView } from 'a24z-memory';
export interface CityConfigBuilderProps {
    fileSystemTree: FileTree;
    onConfigGenerated?: (config: CodebaseView) => void;
    onGroupsChange?: (groups: GridGroup[]) => void;
    theme?: any;
    showGridLines?: boolean;
    initialGroups?: GridGroup[];
    initialGridSize?: GridSize;
}
export interface GroupSelectorProps {
    rootItems: RootItem[];
    selectedDirectories: Set<string>;
    onToggleSelection: (path: string) => void;
    onNext: () => void;
    onCancel: () => void;
    isEditing?: boolean;
    theme?: any;
}
export interface GroupNamingProps {
    selectedCount: number;
    currentName: string;
    onNameChange: (name: string) => void;
    onNext: () => void;
    onBack: () => void;
    theme?: any;
}
export interface GridPositionerProps {
    gridSize: GridSize;
    groups: GridGroup[];
    currentGroupName: string;
    onPositionSelect: (row: number, col: number) => void;
    onBack: () => void;
    isEditing?: boolean;
    editingGroupId?: string | null;
    theme?: any;
}
export interface GroupsListProps {
    groups: GridGroup[];
    onEditGroup: (groupId: string) => void;
    onMoveGroup: (groupId: string) => void;
    onDeleteGroup: (groupId: string) => void;
    theme?: any;
}
export interface GridConfig {
    version: string;
    enabled: boolean;
    overviewPath?: string;
    rows: number;
    cols: number;
    groups: Record<string, any>;
    cellPadding?: number;
    unassignedCell?: [number, number];
    unassignedStrategy?: 'single-cell' | 'distribute' | 'nearest-empty';
    showCellLabels?: boolean;
    cellLabelPosition?: 'none' | 'top' | 'bottom';
    cellLabelHeightPercent?: number;
    timestamp?: string;
    repository?: string;
}
//# sourceMappingURL=types.d.ts.map
import type { StoryObj } from '@storybook/react';
import { CityData } from '../types/cityData';
import { ArchitectureMapHighlightLayers } from './ArchitectureMapHighlightLayers';
declare const meta: {
    title: string;
    component: typeof ArchitectureMapHighlightLayers;
    parameters: {
        layout: string;
    };
    decorators: ((Story: import("storybook/internal/csf").PartialStoryFn<import("@storybook/react").ReactRenderer, {
        cityData?: CityData | undefined;
        highlightLayers?: import("..").HighlightLayer[] | undefined;
        onLayerToggle?: ((layerId: string, enabled: boolean) => void) | undefined;
        showLayerControls?: boolean | undefined;
        defaultBuildingColor?: string | undefined;
        focusDirectory?: string | null | undefined;
        rootDirectoryName?: string | undefined;
        onDirectorySelect?: ((directory: string | null) => void) | undefined;
        onFileClick?: ((path: string, type: "file" | "directory") => void) | undefined;
        fullSize?: boolean | undefined;
        showGrid?: boolean | undefined;
        showFileNames?: boolean | undefined;
        className?: string | undefined;
        selectiveRender?: import("../types/cityData").SelectiveRenderOptions | undefined;
        canvasBackgroundColor?: string | undefined;
        hoverBorderColor?: string | undefined;
        disableOpacityDimming?: boolean | undefined;
        defaultDirectoryColor?: string | undefined;
        subdirectoryMode?: {
            enabled?: boolean;
            rootPath?: string;
            autoCenter?: boolean;
            filters?: Array<{
                path: string;
                mode: "include" | "exclude";
            }>;
            combineMode?: "union" | "intersection";
        } | null | undefined;
        showFileTypeIcons?: boolean | undefined;
        showLegend?: boolean | undefined;
        showDirectoryLabels?: boolean | undefined;
        transform?: {
            rotation?: 0 | 90 | 180 | 270;
            flipHorizontal?: boolean;
            flipVertical?: boolean;
        } | undefined;
        onHover?: ((info: {
            hoveredDistrict: import("../types/cityData").CityDistrict | null;
            hoveredBuilding: import("../types/cityData").CityBuilding | null;
            mousePos: {
                x: number;
                y: number;
            };
            fileTooltip: {
                text: string;
            } | null;
            directoryTooltip: {
                text: string;
            } | null;
            fileCount: number | null;
        }) => void) | undefined;
        buildingBorderRadius?: number | undefined;
        districtBorderRadius?: number | undefined;
    }>) => import("react/jsx-runtime").JSX.Element)[];
};
export default meta;
type Story = StoryObj<typeof meta>;
export declare const DefaultsTest: Story;
export declare const TwoByTwoGrid: Story;
export declare const ThreeByThreeGrid: Story;
export declare const CenteredCore: Story;
export declare const PriorityBasedAssignment: Story;
export declare const SingleColumnLayout: Story;
export declare const LabelsDemo: Story;
export declare const PatternMatchingShowcase: Story;
export declare const NegationPatterns: Story;
export declare const ElectronAppPattern: Story;
export declare const DirectoryOnlyStructure: Story;
export declare const BashStylePatterns: Story;
//# sourceMappingURL=ArchitectureMapGridLayout.stories.d.ts.map
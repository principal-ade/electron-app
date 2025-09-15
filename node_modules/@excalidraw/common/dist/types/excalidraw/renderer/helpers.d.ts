import type { ElementsMap, ExcalidrawDiamondElement, ExcalidrawRectanguloidElement } from "@excalidraw/element/types";
import type { StaticCanvasRenderConfig } from "../scene/types";
import type { AppState, StaticCanvasAppState } from "../types";
export declare const fillCircle: (context: CanvasRenderingContext2D, cx: number, cy: number, radius: number, stroke: boolean, fill?: boolean) => void;
export declare const getNormalizedCanvasDimensions: (canvas: HTMLCanvasElement, scale: number) => [number, number];
export declare const bootstrapCanvas: ({ canvas, scale, normalizedWidth, normalizedHeight, theme, isExporting, viewBackgroundColor, }: {
    canvas: HTMLCanvasElement;
    scale: number;
    normalizedWidth: number;
    normalizedHeight: number;
    theme?: import("@excalidraw/element/types").Theme | undefined;
    isExporting?: boolean | undefined;
    viewBackgroundColor?: string | null | undefined;
}) => CanvasRenderingContext2D;
export declare const drawHighlightForRectWithRotation: (context: CanvasRenderingContext2D, element: ExcalidrawRectanguloidElement, elementsMap: ElementsMap, padding: number) => void;
export declare const strokeEllipseWithRotation: (context: CanvasRenderingContext2D, width: number, height: number, cx: number, cy: number, angle: number) => void;
export declare const strokeRectWithRotation: (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, cx: number, cy: number, angle: number, fill?: boolean, radius?: number) => void;
export declare const drawHighlightForDiamondWithRotation: (context: CanvasRenderingContext2D, padding: number, element: ExcalidrawDiamondElement, elementsMap: ElementsMap) => void;

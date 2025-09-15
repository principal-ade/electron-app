import type { ColorPaletteCustom } from "@excalidraw/common";
interface ShadeListProps {
    color: string | null;
    onChange: (color: string) => void;
    palette: ColorPaletteCustom;
}
export declare const ShadeList: ({ color, onChange, palette }: ShadeListProps) => import("react/jsx-runtime").JSX.Element;
export {};

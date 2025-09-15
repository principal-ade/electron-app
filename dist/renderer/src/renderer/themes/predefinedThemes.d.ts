import { Theme } from 'themed-markdown';
export declare const iconThemes: {
    default: {
        eyeColor: string;
        style: "gradient";
    };
    professional: {
        eyeColor: string;
        style: "solid";
    };
    ocean: {
        eyeColor: string;
        style: "glow";
    };
    sunset: {
        eyeColor: string;
        style: "gradient";
    };
    minimal: {
        eyeColor: string;
        style: "solid";
    };
    highContrast: {
        eyeColor: string;
        style: "solid";
    };
};
export declare const predefinedThemes: Record<string, {
    name: string;
    description: string;
    theme: Theme;
    iconTheme?: typeof iconThemes.default;
}>;
export declare const getThemeNames: () => string[];
export declare const getThemeByName: (name: string) => Theme | undefined;
export declare const getThemeInfo: (name: string) => {
    name: string;
    description: string;
} | undefined;
//# sourceMappingURL=predefinedThemes.d.ts.map
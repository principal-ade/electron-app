export declare class ClipboardService {
    static readText(): Promise<{
        success: boolean;
        text: string;
    }>;
    static writeText(text: string): Promise<boolean>;
}
//# sourceMappingURL=ClipboardService.d.ts.map
declare class DiagramEventBus {
    private listeners;
    on(event: string, callback: Function): () => void;
    emit(event: string, ...args: any[]): void;
    off(event: string, callback?: Function): void;
}
export declare const diagramEventBus: DiagramEventBus;
export declare const DIAGRAM_EVENTS: {
    readonly DIAGRAM_SAVED: "diagram:saved";
    readonly DIAGRAM_CREATED: "diagram:created";
    readonly DIAGRAM_DELETED: "diagram:deleted";
};
export {};
//# sourceMappingURL=DiagramEventBus.d.ts.map
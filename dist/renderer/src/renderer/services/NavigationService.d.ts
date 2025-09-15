import { EventEmitter } from '../utils/EventEmitter';
export type ViewType = 'landing' | 'presentation' | 'project' | 'favorites';
export type NavigationTab = 'recent' | 'favorites' | 'projects';
interface NavigationState {
    currentView: ViewType;
    activeTab: NavigationTab;
    currentSlide: number;
    totalSlides: number;
    currentPath?: string;
    currentProjectId?: string;
    breadcrumbs: BreadcrumbItem[];
    canGoBack: boolean;
    canGoForward: boolean;
}
interface BreadcrumbItem {
    label: string;
    path?: string;
    viewType: ViewType;
    data?: any;
}
export declare class NavigationService extends EventEmitter {
    private static instance;
    private state;
    private history;
    private historyIndex;
    private maxHistorySize;
    private constructor();
    static getInstance(): NavigationService;
    navigateToLanding(tab?: NavigationTab): void;
    navigateToPresentation(path: string, totalSlides: number, initialSlide?: number): void;
    navigateToProject(projectId: string, projectName: string): void;
    navigateToFavorites(): void;
    goToSlide(slideIndex: number): void;
    nextSlide(): void;
    previousSlide(): void;
    setActiveTab(tab: NavigationTab): void;
    private addToHistory;
    goBack(): void;
    goForward(): void;
    canGoBack(): boolean;
    canGoForward(): boolean;
    private restoreFromHistory;
    private updateNavigationState;
    navigateToBreadcrumb(index: number): void;
    getCurrentView(): ViewType;
    getActiveTab(): NavigationTab;
    getCurrentSlide(): number;
    getTotalSlides(): number;
    getCurrentPath(): string | undefined;
    getCurrentProjectId(): string | undefined;
    getBreadcrumbs(): BreadcrumbItem[];
    getNavigationState(): Readonly<NavigationState>;
    registerKeyboardShortcuts(): () => void;
    reset(): void;
}
export declare const navigationService: NavigationService;
export {};
//# sourceMappingURL=NavigationService.d.ts.map
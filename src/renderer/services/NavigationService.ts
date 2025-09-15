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

interface NavigationHistoryItem {
  viewType: ViewType;
  path?: string;
  projectId?: string;
  slide?: number;
  tab?: NavigationTab;
  timestamp: number;
}

export class NavigationService extends EventEmitter {
  private static instance: NavigationService;

  private state: NavigationState;

  private history: NavigationHistoryItem[] = [];

  private historyIndex: number = -1;

  private maxHistorySize: number = 50;

  private constructor() {
    super();
    this.state = {
      currentView: 'landing',
      activeTab: 'recent',
      currentSlide: 0,
      totalSlides: 0,
      breadcrumbs: [{ label: 'Home', viewType: 'landing' }],
      canGoBack: false,
      canGoForward: false,
    };
  }

  static getInstance(): NavigationService {
    if (!NavigationService.instance) {
      NavigationService.instance = new NavigationService();
    }
    return NavigationService.instance;
  }

  // Navigation methods
  navigateToLanding(tab?: NavigationTab) {
    this.addToHistory();
    this.state = {
      ...this.state,
      currentView: 'landing',
      activeTab: tab || this.state.activeTab,
      currentSlide: 0,
      totalSlides: 0,
      currentPath: undefined,
      currentProjectId: undefined,
      breadcrumbs: [{ label: 'Home', viewType: 'landing' }],
    };
    this.updateNavigationState();
    this.emit('navigate', this.state);
  }

  navigateToPresentation(
    path: string,
    totalSlides: number,
    initialSlide: number = 0,
  ) {
    this.addToHistory();
    const fileName = path.split('/').pop() || path;
    this.state = {
      ...this.state,
      currentView: 'presentation',
      currentPath: path,
      currentSlide: initialSlide,
      totalSlides,
      breadcrumbs: [
        { label: 'Home', viewType: 'landing' },
        { label: fileName, viewType: 'presentation', path },
      ],
    };
    this.updateNavigationState();
    this.emit('navigate', this.state);
  }

  navigateToProject(projectId: string, projectName: string) {
    this.addToHistory();
    this.state = {
      ...this.state,
      currentView: 'project',
      currentProjectId: projectId,
      currentSlide: 0,
      totalSlides: 0,
      breadcrumbs: [
        { label: 'Home', viewType: 'landing' },
        { label: 'Projects', viewType: 'landing', data: { tab: 'projects' } },
        { label: projectName, viewType: 'project', data: { projectId } },
      ],
    };
    this.updateNavigationState();
    this.emit('navigate', this.state);
  }

  navigateToFavorites() {
    this.addToHistory();
    this.state = {
      ...this.state,
      currentView: 'favorites',
      currentSlide: 0,
      totalSlides: 0,
      breadcrumbs: [
        { label: 'Home', viewType: 'landing' },
        { label: 'Favorites', viewType: 'favorites' },
      ],
    };
    this.updateNavigationState();
    this.emit('navigate', this.state);
  }

  // Slide navigation
  goToSlide(slideIndex: number) {
    if (slideIndex >= 0 && slideIndex < this.state.totalSlides) {
      this.state.currentSlide = slideIndex;
      this.emit('slideChange', slideIndex);
    }
  }

  nextSlide() {
    if (this.state.currentSlide < this.state.totalSlides - 1) {
      this.goToSlide(this.state.currentSlide + 1);
    }
  }

  previousSlide() {
    if (this.state.currentSlide > 0) {
      this.goToSlide(this.state.currentSlide - 1);
    }
  }

  // Tab navigation
  setActiveTab(tab: NavigationTab) {
    this.state.activeTab = tab;
    this.emit('tabChange', tab);
  }

  // History management
  private addToHistory() {
    const historyItem: NavigationHistoryItem = {
      viewType: this.state.currentView,
      path: this.state.currentPath,
      projectId: this.state.currentProjectId,
      slide: this.state.currentSlide,
      tab: this.state.activeTab,
      timestamp: Date.now(),
    };

    // Remove forward history when navigating to new location
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(historyItem);
    this.historyIndex++;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
      this.historyIndex = this.history.length - 1;
    }

    this.updateNavigationState();
  }

  goBack() {
    if (this.canGoBack()) {
      this.historyIndex--;
      this.restoreFromHistory(this.history[this.historyIndex]);
    }
  }

  goForward() {
    if (this.canGoForward()) {
      this.historyIndex++;
      this.restoreFromHistory(this.history[this.historyIndex]);
    }
  }

  canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  private restoreFromHistory(item: NavigationHistoryItem) {
    this.state = {
      ...this.state,
      currentView: item.viewType,
      currentPath: item.path,
      currentProjectId: item.projectId,
      currentSlide: item.slide || 0,
      activeTab: item.tab || 'recent',
    };
    this.updateNavigationState();
    this.emit('navigate', this.state);
    this.emit('historyRestore', item);
  }

  private updateNavigationState() {
    this.state.canGoBack = this.canGoBack();
    this.state.canGoForward = this.canGoForward();
  }

  // Breadcrumb navigation
  navigateToBreadcrumb(index: number) {
    const breadcrumb = this.state.breadcrumbs[index];
    if (!breadcrumb) return;

    switch (breadcrumb.viewType) {
      case 'landing':
        this.navigateToLanding(breadcrumb.data?.tab);
        break;
      case 'presentation':
        if (breadcrumb.path) {
          // Would need to reload the presentation
          this.emit('reloadPresentation', breadcrumb.path);
        }
        break;
      case 'project':
        if (breadcrumb.data?.projectId) {
          this.emit('reloadProject', breadcrumb.data.projectId);
        }
        break;
      case 'favorites':
        this.navigateToFavorites();
        break;
    }
  }

  // State getters
  getCurrentView(): ViewType {
    return this.state.currentView;
  }

  getActiveTab(): NavigationTab {
    return this.state.activeTab;
  }

  getCurrentSlide(): number {
    return this.state.currentSlide;
  }

  getTotalSlides(): number {
    return this.state.totalSlides;
  }

  getCurrentPath(): string | undefined {
    return this.state.currentPath;
  }

  getCurrentProjectId(): string | undefined {
    return this.state.currentProjectId;
  }

  getBreadcrumbs(): BreadcrumbItem[] {
    return [...this.state.breadcrumbs];
  }

  getNavigationState(): Readonly<NavigationState> {
    return { ...this.state };
  }

  // Keyboard shortcuts
  registerKeyboardShortcuts() {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (this.state.currentView === 'presentation') {
            this.previousSlide();
          }
          break;
        case 'ArrowRight':
          if (this.state.currentView === 'presentation') {
            this.nextSlide();
          }
          break;
        case 'Escape':
          if (this.state.currentView !== 'landing') {
            this.navigateToLanding();
          }
          break;
        case 'Home':
          if (this.state.currentView === 'presentation') {
            this.goToSlide(0);
          }
          break;
        case 'End':
          if (this.state.currentView === 'presentation') {
            this.goToSlide(this.state.totalSlides - 1);
          }
          break;
      }

      // Cmd/Ctrl + Arrow for history navigation
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            this.goBack();
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.goForward();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    // Return cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }

  // Reset navigation
  reset() {
    this.state = {
      currentView: 'landing',
      activeTab: 'recent',
      currentSlide: 0,
      totalSlides: 0,
      breadcrumbs: [{ label: 'Home', viewType: 'landing' }],
      canGoBack: false,
      canGoForward: false,
    };
    this.history = [];
    this.historyIndex = -1;
    this.emit('reset');
  }
}

// Export singleton instance
export const navigationService = NavigationService.getInstance();

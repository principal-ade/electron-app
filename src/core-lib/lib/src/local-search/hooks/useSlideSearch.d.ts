import { SlideSearchEngine } from '../SlideSearchEngine';
import { SearchOptions, SlideSearchMatch } from '../types';
export interface UseSlideSearchOptions {
    debounceMs?: number;
    searchOptions?: SearchOptions;
}
export declare function useSlideSearch(searchEngine: SlideSearchEngine, options?: UseSlideSearchOptions): {
    searchQuery: string;
    setSearchQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
    searchResults: SlideSearchMatch[];
    isSearching: boolean;
    totalDocuments: number;
    error: string | undefined;
    performSearch: (query: string) => Promise<void>;
    clearResults: () => void;
};
//# sourceMappingURL=useSlideSearch.d.ts.map
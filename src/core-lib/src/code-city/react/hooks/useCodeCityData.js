import { useState, useEffect, useMemo } from 'react';
import { MultiVersionCityBuilder } from '../../builder';
export function useCodeCityData({ fileSystemTree, autoUpdate = true, }) {
    const [cityData, setCityData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // UI state
    const [highlightedPaths, setHighlightedPaths] = useState(new Set());
    const [selectedPaths, setSelectedPaths] = useState(new Set());
    const [focusDirectory, setFocusDirectory] = useState(null);
    // Rebuild city data
    const rebuild = useMemo(() => {
        return () => {
            if (!fileSystemTree) {
                setCityData(null);
                setError('No file system tree provided');
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                // Create a single-version map for the builder
                const versionMap = new Map([['main', fileSystemTree]]);
                const { unionCity } = MultiVersionCityBuilder.build(versionMap);
                setCityData(unionCity);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to build city data');
                setCityData(null);
            }
            finally {
                setIsLoading(false);
            }
        };
    }, [fileSystemTree]);
    // Auto rebuild when dependencies change
    useEffect(() => {
        if (autoUpdate) {
            rebuild();
        }
    }, [autoUpdate, rebuild]);
    return {
        cityData,
        isLoading,
        error,
        rebuild,
        setHighlightedPaths,
        setSelectedPaths,
        setFocusDirectory,
        highlightedPaths,
        selectedPaths,
        focusDirectory,
    };
}

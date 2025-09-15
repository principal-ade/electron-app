import { useEffect, useState } from 'react';
import { ThemeService } from '../services/ThemeService';
import { IconThemeService } from '../services/IconThemeService';

/**
 * Hook to get themed icon URL for current theme
 * Automatically updates when theme changes
 */
export function useThemedIcon(
  size: number = 48,
  fallbackSrc: string = '/assets/icons/owl-default.png'
): {
  iconSrc: string;
  isLoading: boolean;
  error: string | null;
} {
  const [iconSrc, setIconSrc] = useState<string>(fallbackSrc);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadIcon = async () => {
    const themeName = ThemeService.getCurrentThemeName();
    
    // Check cache first
    const cached = IconThemeService.getCachedIcon(themeName, size);
    if (cached) {
      setIconSrc(cached);
      setIsLoading(false);
      return;
    }
    
    // Generate if not cached
    setIsLoading(true);
    setError(null);
    
    try {
      const generatedIcon = await IconThemeService.generateThemedIcon(themeName, size);
      if (generatedIcon) {
        setIconSrc(generatedIcon);
      } else {
        throw new Error('Failed to generate icon');
      }
    } catch (err) {
      console.error('[useThemedIcon] Failed to generate icon:', err);
      setError('Failed to load themed icon');
      setIconSrc(fallbackSrc);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load on mount and size change
  useEffect(() => {
    loadIcon();
  }, [size]);
  
  // Subscribe to theme changes
  useEffect(() => {
    const unsubscribe = ThemeService.onThemeChange(() => {
      loadIcon();
    });
    
    return () => {
      unsubscribe();
    };
  }, [size]);
  
  return { iconSrc, isLoading, error };
}
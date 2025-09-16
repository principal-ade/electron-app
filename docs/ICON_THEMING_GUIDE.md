# Icon Theming Guide

## Overview
The PrincipleMD owl icon uses a layered approach for efficient theming. Icons are generated once when themes switch, then cached for optimal performance.

## Required Icon Assets

Place the following PNG files in `/public/assets/icons/owl/`:

### Layer Files (Grayscale PNGs with transparency)
1. **body.png** - The owl's body and head (grayscale)
2. **eyes-base.png** - White part of the eyes 
3. **eyes-iris.png** - Iris layer (grayscale - will be colorized)
4. **pupils.png** - Black pupils (always black)
5. **highlight.png** - Eye sparkle/highlights (white)

### Optional Files
- **owl-default.png** - Fallback image if generation fails

## Asset Preparation

### Creating the Layers from Your Design

1. **Export from your design tool** (Figma, Sketch, Photoshop, etc.):
   - Size: 256x256px or higher for best quality
   - Format: PNG with transparency
   - Color mode: RGB

2. **Layer Guidelines**:
   - **body.png**: Should be grayscale (will be brightness-adjusted for themes)
   - **eyes-iris.png**: Must be grayscale (will be colorized with theme colors)
   - **Other layers**: Keep their intended colors

3. **Optimization**:
   ```bash
   # Use pngquant to optimize file sizes
   pngquant --quality=65-80 *.png
   
   # Or use ImageOptim on macOS
   ```

## How It Works

1. **Theme Switch**: When user changes theme, `ThemeService` triggers icon generation
2. **Generation**: `IconThemeService` composites layers with theme-specific colors
3. **Caching**: Generated icons are cached as data URLs
4. **Usage**: Components use cached icons - no runtime computation needed

## Usage in Components

### Simple Usage
```tsx
import { CachedThemedOwl } from '@/components/icons/CachedThemedOwl';

// In your component
<CachedThemedOwl size={48} />
```

### With Hook
```tsx
import { useThemedIcon } from '@/hooks/useThemedIcon';

function MyComponent() {
  const { iconSrc, isLoading } = useThemedIcon(48);
  
  return <img src={iconSrc} alt="Logo" />;
}
```

### Manual Generation
```tsx
import { IconThemeService } from '@/services/IconThemeService';

// Generate icon for specific theme
const iconDataUrl = await IconThemeService.generateThemedIcon('ocean', 64);
```

## Theme Configuration

Each theme defines its owl eye color in `predefinedThemes.ts`:

```typescript
export const iconThemes = {
  default: {
    eyeColor: '#1976D2',    // Blue
    style: 'gradient'
  },
  ocean: {
    eyeColor: '#0891B2',    // Teal
    style: 'glow'
  },
  sunset: {
    eyeColor: '#EA580C',    // Orange
    style: 'gradient'
  }
  // ... more themes
};
```

## Performance Benefits

- **One-time Generation**: Icons generated only on theme switch
- **Cached Results**: No repeated canvas operations
- **Data URLs**: No network requests after generation
- **Multiple Sizes**: Common sizes pre-generated and cached

## Customization

### Adding New Eye Colors
Edit the theme's `iconTheme` configuration:
```typescript
professional: {
  eyeColor: '#003D82',  // Your custom color
  style: 'solid'        // gradient | solid | glow
}
```

### Custom Effects
Modify `IconThemeService.generateThemedIcon()` to add:
- Shadows
- Glows
- Gradients
- Blend modes

## Troubleshooting

### Icons Not Loading
1. Check browser console for errors
2. Verify image files exist in `/public/assets/icons/owl/`
3. Check file permissions
4. Clear cache: `IconThemeService.clearCache()`

### Wrong Colors
1. Ensure eyes-iris.png is grayscale
2. Check theme configuration has correct hex colors
3. Verify IconThemeService is using correct theme name

### Performance Issues
1. Reduce generation sizes (default is 256px)
2. Pre-generate common sizes on app startup
3. Use fallback images for immediate display

## Future Enhancements

- [ ] Add SVG support for infinite scalability
- [ ] Support animated transitions between themes
- [ ] Add seasonal/holiday theme variations
- [ ] Create theme preview in settings
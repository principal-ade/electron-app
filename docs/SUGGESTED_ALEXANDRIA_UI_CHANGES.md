# Suggested Changes for alexandria-ui QualityHexagon Component

## Current Issues
1. **Fixed Size Options**: Component only supports 'sm' | 'md' | 'lg' | 'xl' with hardcoded pixel values
2. **Hover-based Information**: Metrics are shown in tooltip on hover, not always visible
3. **Not Responsive**: Cannot dynamically scale to container size

## Suggested Changes

### 1. Add Dynamic Sizing Support

```typescript
// Add to QualityHexagonProps
interface QualityHexagonProps {
  // ... existing props
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'dynamic';
  containerWidth?: number; // For dynamic sizing
  containerHeight?: number; // For dynamic sizing
}

// Update size handling
export function QualityHexagon({
  // ... existing props
  size = 'md',
  containerWidth,
  containerHeight,
  // ...
}: QualityHexagonProps) {
  let config;

  if (size === 'dynamic' && containerWidth && containerHeight) {
    const minDimension = Math.min(containerWidth, containerHeight);
    config = {
      size: minDimension * 0.6,
      fontSize: minDimension * 0.04,
      strokeWidth: minDimension * 0.008,
      dotSize: minDimension * 0.02,
      padding: minDimension * 0.15
    };
  } else {
    config = sizeConfig[size as keyof typeof sizeConfig];
  }

  // Use viewBox for proper scaling
  return (
    <svg
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      width={containerWidth || svgSize}
      height={containerHeight || svgSize}
      preserveAspectRatio="xMidYMid meet"
      className={cn('transition-all duration-300', className)}
    >
      {/* ... rest of SVG content */}
    </svg>
  );
}
```

### 2. Add Always-Visible Metrics Display

```typescript
// Add new prop
interface QualityHexagonProps {
  // ... existing props
  displayMode?: 'tooltip' | 'below' | 'none';
}

// Create new component for below display
function MetricsDisplay({ metrics, tier }: { metrics: QualityMetrics; tier: QualityTier }) {
  return (
    <div className="mt-4 space-y-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        {metricConfig.map(({ key, label, color }) => {
          let value = metrics[key as keyof QualityMetrics];
          let displayValue = value;

          if (key === 'deadCode') {
            value = 100 - value; // For color evaluation
          }

          return (
            <div key={key} className="flex items-center justify-between p-1">
              <span className="flex items-center gap-1">
                <div className={cn('w-2 h-2 rounded-full', color)} />
                <span className="text-muted-foreground">
                  {label}:
                </span>
              </span>
              <span className={cn(
                'font-medium',
                value >= 80 ? 'text-green-600' :
                value >= 60 ? 'text-yellow-600' :
                'text-red-600'
              )}>
                {displayValue}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Update main component
export function QualityHexagon({
  // ... existing props
  displayMode = 'tooltip',
  // ...
}: QualityHexagonProps) {
  const hexagon = (
    <svg>
      {/* ... existing SVG content */}
    </svg>
  );

  if (displayMode === 'none') {
    return hexagon;
  }

  if (displayMode === 'below') {
    return (
      <div>
        {hexagon}
        <MetricsDisplay metrics={metrics} tier={tier} />
      </div>
    );
  }

  // Default tooltip mode (existing behavior)
  return (
    <TooltipProvider>
      {/* ... existing tooltip implementation */}
    </TooltipProvider>
  );
}
```

### 3. Use Container Query for True Responsiveness

```typescript
// Alternative approach using container queries
export function QualityHexagonResponsive({
  metrics,
  tier,
  displayMode = 'below',
  className
}: Omit<QualityHexagonProps, 'size'>) {
  return (
    <div className={cn('w-full h-full', className)}>
      <div className="@container w-full h-full">
        <div className="@[200px]:scale-75 @[300px]:scale-100 @[400px]:scale-125 w-full h-full flex flex-col items-center justify-center">
          <svg
            viewBox="0 0 300 300"
            className="w-full h-full max-w-full max-h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* SVG content with fixed internal coordinates */}
            {/* Use viewBox for scaling */}
          </svg>
          {displayMode === 'below' && (
            <MetricsDisplay metrics={metrics} tier={tier} />
          )}
        </div>
      </div>
    </div>
  );
}
```

## Implementation in electron-app

Until these changes are made to alexandria-ui, we can create a wrapper component:

```typescript
// QualityHexagonWrapper.tsx
import { QualityHexagon } from '@principal-ai/agent-monitoring-ui';
import { useEffect, useRef, useState } from 'react';

export function QualityHexagonWrapper({ metrics, tier }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Calculate appropriate size based on container
  const size = dimensions.width < 150 ? 'sm' :
               dimensions.width < 250 ? 'md' :
               dimensions.width < 350 ? 'lg' : 'xl';

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center">
      <QualityHexagon
        metrics={metrics}
        tier={tier}
        size={size}
        interactive={false}
        showLabels={false}
      />
      {/* Custom metrics display below */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        {/* ... metrics display */}
      </div>
    </div>
  );
}
```

## Benefits of These Changes

1. **True Responsiveness**: Component scales to fit any container size
2. **Better UX**: Metrics always visible, no need to hover
3. **Flexibility**: Different display modes for different use cases
4. **Accessibility**: Information available without mouse interaction
5. **Mobile-Friendly**: Works on touch devices without hover

## Priority

1. **High Priority**: Add `displayMode` prop to show metrics below hexagon
2. **High Priority**: Support dynamic sizing with viewBox
3. **Medium Priority**: Container query support
4. **Low Priority**: Animation improvements
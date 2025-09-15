# @a24z/panels

A modern React panel layout component library built on top of `react-resizable-panels` with enhanced animations, TypeScript support, and common layout patterns.

## Installation

```bash
npm install @a24z/panels
```

## Quick Start

⚠️ **Important: You must import the CSS file for proper styling:**

```tsx
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/style.css';  // Required!

function App() {
  return (
    <AnimatedResizableLayout
      leftPanel={<div>Left Content</div>}
      rightPanel={<div>Right Content</div>}
      collapsibleSide="left"
      showCollapseButton={true}
    />
  );
}
```

## Current Implementation

We currently have an `AnimatedResizableLayout` component that provides:
- 2-panel horizontal layout (left/right)
- Smooth collapse/expand animations using requestAnimationFrame
- Collapsible panels on either side
- Dark mode support
- Custom collapse toggle button with directional icons
- Animated opacity transitions for content
- Proper handling of drag vs animation states
- Callbacks for animation lifecycle events

### Current Features in Detail

#### Animation System
- **Smooth transitions**: 300ms cubic-bezier easing by default
- **RAF-based animations**: Custom requestAnimationFrame implementation for smooth 60fps animations
- **Dual-state handling**: Distinguishes between user dragging and programmatic animations
- **Content opacity fading**: Panel content fades during collapse/expand
- **Handle visibility**: Resize handle hides when panel is collapsed

#### Styling
- Clean, minimal resize handles (8px width)
- Hover states for interactive elements
- Dark mode support via CSS media queries
- Collapse toggle button with scaling animations on hover/active
- Shadow effects for depth perception

#### API
- `leftPanel` / `rightPanel`: ReactNode content
- `collapsibleSide`: 'left' | 'right'
- `defaultSize`: Initial panel size (0-100)
- `minSize`: Minimum size when expanded
- `collapsed`: Initial collapsed state
- `showCollapseButton`: Toggle button visibility
- `animationDuration` / `animationEasing`: Customizable animations
- Lifecycle callbacks: `onCollapseStart`, `onCollapseComplete`, `onExpandStart`, `onExpandComplete`

## New Package Requirements

### Core Components

#### 1. `ThreePanelLayout`
A horizontal 3-panel layout component with all panels resizable.

```tsx
interface ThreePanelLayoutProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;

  // Sizing
  defaultSizes?: [number, number, number]; // Default: [25, 50, 25]
  minSizes?: [number, number, number];     // Default: [10, 30, 10]

  // Collapsible configuration
  collapsiblePanels?: {
    left?: boolean;
    right?: boolean;
    center?: boolean;  // Rarely used but supported
  };

  // Animation
  animationDuration?: number;  // Default: 300
  animationEasing?: string;     // Default: cubic-bezier

  // Collapse state
  collapsed?: {
    left?: boolean;
    right?: boolean;
  };

  // Controls
  showCollapseButtons?: boolean;
  collapseButtonPosition?: 'handle' | 'panel' | 'both';

  // Styling
  className?: string;
  handleClassName?: string;
  panelClassName?: string;
  theme?: 'light' | 'dark' | 'auto';

  // Callbacks
  onPanelResize?: (sizes: [number, number, number]) => void;
  onPanelCollapse?: (panel: 'left' | 'center' | 'right') => void;
  onPanelExpand?: (panel: 'left' | 'center' | 'right') => void;

  // Persistence
  persistenceKey?: string;  // Save layout to localStorage
}
```

#### 2. `TwoPanelLayout`
A simplified 2-panel version using the native `react-resizable-panels` animations.

```tsx
interface TwoPanelLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;

  orientation?: 'horizontal' | 'vertical';
  defaultSize?: number;
  minSize?: number;

  collapsibleSide?: 'left' | 'right' | 'both';
  collapsed?: 'left' | 'right' | null;

  // Similar animation, styling, callback props as ThreePanelLayout
}
```

#### 3. `AdaptiveLayout`
A responsive layout that switches between layouts based on viewport size.

```tsx
interface AdaptiveLayoutProps {
  panels: ReactNode[];

  breakpoints?: {
    mobile?: number;   // Default: 768
    tablet?: number;   // Default: 1024
    desktop?: number;  // Default: 1440
  };

  layouts?: {
    mobile?: 'stack' | 'tabs' | 'drawer';
    tablet?: 'two-panel' | 'drawer-main';
    desktop?: 'three-panel' | 'two-panel';
  };

  // All other props from ThreePanelLayout
}
```

### Features to Implement

#### Must Have (v1.0)
- [x] Smooth native animations using `react-resizable-panels` built-in transitions
- [x] TypeScript definitions with strict typing
- [x] 2-panel and 3-panel layouts
- [x] Collapsible panels with animation
- [x] Dark mode support
- [x] Collapse/expand toggle buttons
- [x] Keyboard accessibility (arrow keys for resize, space/enter for toggle)
- [x] Proper ARIA labels
- [x] Zero dependencies except `react-resizable-panels`
- [x] < 10KB gzipped

#### Nice to Have (v1.1+)
- [ ] Persistence to localStorage
- [ ] Drag handle customization
- [ ] Custom collapse button components
- [ ] Snap points for panel sizes
- [ ] Double-click to reset panel size
- [ ] Nested panel support
- [ ] Vertical orientation support
- [ ] Touch gesture support for mobile
- [ ] Server-side rendering support
- [ ] Presets (sidebar layouts, dashboard layouts, etc.)

### Technical Requirements

#### Build Setup
```json
{
  "name": "@a24z/panels",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0",
    "react-resizable-panels": "^2.0.0"
  },
  "devDependencies": {
    "@storybook/react": "^7.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

#### Storybook Stories
- Basic 2-panel layout
- Basic 3-panel layout
- Collapsible panels demo
- Dark mode toggle
- Animated collapse/expand
- Responsive adaptive layout
- Nested panels
- Custom styling examples
- Persistence demo
- Accessibility demo

### Migration Guide from Current Implementation

#### Key Differences
1. **Use native `react-resizable-panels` animations** instead of custom RAF implementation
2. **Support 3 panels** out of the box
3. **Simplified API** - less boilerplate needed
4. **Better TypeScript support** with generics for panel content types
5. **Built-in persistence** via localStorage
6. **Responsive layouts** with AdaptiveLayout component

#### Migration Steps
```tsx
// Old
import { AnimatedResizableLayout } from './layout-components';

<AnimatedResizableLayout
  leftPanel={<Sidebar />}
  rightPanel={<MainContent />}
  collapsibleSide="left"
  defaultSize={25}
  showCollapseButton={true}
/>

// New
import { TwoPanelLayout } from '@a24z/panels';

<TwoPanelLayout
  leftPanel={<Sidebar />}
  rightPanel={<MainContent />}
  collapsibleSide="left"
  defaultSize={25}
  showCollapseButtons={true}
/>
```

### Example Usage

#### Basic 3-Panel Layout
```tsx
import { ThreePanelLayout } from '@a24z/panels';

function App() {
  return (
    <ThreePanelLayout
      leftPanel={<Navigation />}
      centerPanel={<MainContent />}
      rightPanel={<Sidebar />}
      defaultSizes={[20, 60, 20]}
      collapsiblePanels={{ left: true, right: true }}
      showCollapseButtons
      theme="auto"
      persistenceKey="app-layout"
    />
  );
}
```

#### Responsive Adaptive Layout
```tsx
import { AdaptiveLayout } from '@a24z/panels';

function App() {
  return (
    <AdaptiveLayout
      panels={[<Nav />, <Main />, <Side />]}
      layouts={{
        mobile: 'drawer',
        tablet: 'two-panel',
        desktop: 'three-panel'
      }}
    />
  );
}
```

### Development Workflow

1. **Setup**: Clone repo, install dependencies
2. **Development**: Run Storybook for component development
3. **Testing**: Unit tests with React Testing Library
4. **Build**: Vite for bundling
5. **Publish**: NPM with proper versioning

### API Design Principles

1. **Progressive disclosure**: Simple use cases should be simple
2. **Sensible defaults**: Works well out of the box
3. **Composition over configuration**: Prefer component composition
4. **Type safety**: Full TypeScript support with inference
5. **Performance**: Use native browser APIs and React features
6. **Accessibility**: WCAG 2.1 AA compliance

### Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

### License

MIT

---

## Implementation Notes for Developer

### Priority Order
1. Start with `TwoPanelLayout` to replace current implementation
2. Extend to `ThreePanelLayout` with similar API
3. Add `AdaptiveLayout` for responsive designs
4. Create comprehensive Storybook stories
5. Add unit tests
6. Setup CI/CD pipeline
7. Publish to NPM

### Key Technical Decisions
- Use `react-resizable-panels` v2+ for native collapse animations
- Avoid custom RAF logic - the library handles this now
- Use CSS modules or styled-components for styling isolation
- Implement with hooks only (no class components)
- Use React.memo for performance optimization
- Provide both controlled and uncontrolled modes

### Testing Checklist
- [ ] Keyboard navigation works
- [ ] Screen readers announce panel states
- [ ] Animations are smooth at 60fps
- [ ] No memory leaks on unmount
- [ ] Works with React 18 concurrent features
- [ ] SSR compatible (no window references in initial render)
- [ ] Touch gestures work on mobile
- [ ] Resize observer cleanup
- [ ] Dark mode transitions smoothly
- [ ] localStorage persistence handles edge cases
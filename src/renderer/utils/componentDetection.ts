/**
 * Enhanced component detection utilities
 */

interface ComponentInfo {
  name: string;
  path: string;
  props?: unknown;
}

// React fiber node type definition (simplified)
interface FiberNode {
  type?: unknown;
  elementType?: unknown;
  tag?: number;
  stateNode?: unknown;
  return?: FiberNode;
  child?: FiberNode;
  sibling?: FiberNode;
  _debugSource?: {
    fileName?: string;
    lineNumber?: number;
  };
  _debugOwner?: FiberNode;
}

/**
 * Find React fiber instance from DOM element
 */
function findFiberFromDOM(element: HTMLElement): FiberNode | null {
  const key = Object.keys(element).find(
    (key) =>
      key.startsWith('__reactInternalInstance$') ||
      key.startsWith('__reactFiber$') ||
      key.startsWith('_reactInternalFiber') ||
      key.startsWith('_reactInternalInstance'),
  );

  if (key) {
    return (element as unknown as Record<string, unknown>)[key] as FiberNode;
  }

  // Try React 17+ keys
  const reactProps = Object.keys(element).find((key) =>
    key.startsWith('__reactProps$'),
  );

  if (reactProps) {
    // For React 17+, we need to traverse differently
    const propsKey = Object.keys(element).find((key) =>
      key.startsWith('__reactFiber$'),
    );
    if (propsKey) {
      return (element as unknown as Record<string, unknown>)[propsKey] as FiberNode;
    }
  }

  return null;
}

/**
 * Get component name from fiber node
 */
function getComponentNameFromFiber(fiber: FiberNode): string {
  if (!fiber) return 'Unknown';

  // Try different ways to get component name
  if (fiber.type) {
    if (typeof fiber.type === 'function') {
      return (fiber.type as { displayName?: string; name?: string }).displayName ||
             (fiber.type as { displayName?: string; name?: string }).name ||
             'Component';
    }
    if (typeof fiber.type === 'string') {
      return fiber.type; // DOM element
    }
    const typeWithProps = fiber.type as { displayName?: string; name?: string };
    if (typeWithProps.displayName || typeWithProps.name) {
      return typeWithProps.displayName || typeWithProps.name || 'Component';
    }
  }

  if (fiber.elementType) {
    if (typeof fiber.elementType === 'function') {
      const elemType = fiber.elementType as { displayName?: string; name?: string };
      return elemType.displayName || elemType.name || 'Component';
    }
  }

  // Check for memo/forward ref components
  if (fiber.elementType && typeof fiber.elementType === 'object' && fiber.elementType !== null) {
    const elemTypeWithType = fiber.elementType as { type?: unknown };
    const innerType = elemTypeWithType.type;
    if (typeof innerType === 'function') {
      const innerTypeWithProps = innerType as { displayName?: string; name?: string };
      return innerTypeWithProps.displayName || innerTypeWithProps.name || 'Component';
    }
  }

  return 'Unknown';
}

/**
 * Walk up the fiber tree to find the nearest named component
 */
function findNearestComponent(fiber: FiberNode | null): ComponentInfo {
  let currentFiber = fiber;
  let componentName = 'Unknown Component';
  let componentPath = 'Unknown Path';

  while (currentFiber) {
    const name = getComponentNameFromFiber(currentFiber);

    // Skip DOM elements and fragments
    if (
      name !== 'Unknown' &&
      !['div', 'span', 'button', 'p', 'a', 'img', 'svg', 'path', 'g'].includes(
        name,
      )
    ) {
      componentName = name;

      // Try to get source file info
      if (currentFiber._debugSource?.fileName) {
        componentPath = currentFiber._debugSource.fileName;
      }

      break;
    }

    currentFiber = currentFiber.return || currentFiber._debugOwner || null;
  }

  return { name: componentName, path: componentPath };
}

/**
 * Main function to detect React component from DOM element
 */
export function detectReactComponent(element: HTMLElement): ComponentInfo {
  // First check for explicit data attributes
  if (element.dataset.componentName) {
    return {
      name: element.dataset.componentName,
      path: element.dataset.componentPath || 'Unknown Path',
    };
  }

  // Walk up DOM tree looking for React fiber
  let currentElement: HTMLElement | null = element;
  let attempts = 0;
  const maxAttempts = 20; // Prevent infinite loops

  while (currentElement && attempts < maxAttempts) {
    // Check for data attributes on parent elements
    if (currentElement.dataset.componentName) {
      return {
        name: currentElement.dataset.componentName,
        path: currentElement.dataset.componentPath || 'Unknown Path',
      };
    }

    // Try to find React fiber
    const fiber = findFiberFromDOM(currentElement);
    if (fiber) {
      return findNearestComponent(fiber);
    }

    currentElement = currentElement.parentElement;
    attempts++;
  }

  // Fallback - try to infer from class names or IDs
  const classNames = element.className.split(' ').filter(Boolean);
  const id = element.id;

  if (id && /[A-Z]/.test(id)) {
    // ID might be a component name
    return { name: id, path: 'Unknown Path' };
  }

  for (const className of classNames) {
    if (/^[A-Z]/.test(className)) {
      // Might be a component className
      return { name: className, path: 'Unknown Path' };
    }
  }

  return { name: 'Unknown Component', path: 'Unknown Path' };
}

/**
 * Development helper to display component names
 */
export function enableComponentNameDisplay() {
  if (process.env.NODE_ENV === 'development') {
    // Add visual indicators for components in dev mode
    const style = document.createElement('style');
    style.textContent = `
      [data-component-name]::before {
        content: attr(data-component-name);
        position: absolute;
        top: -20px;
        left: 0;
        font-size: 10px;
        background: #333;
        color: #fff;
        padding: 2px 5px;
        border-radius: 2px;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
        z-index: 10000;
      }
      
      [data-component-name]:hover::before {
        opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
  }
}

import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArchitectureMapHighlightLayers } from './ArchitectureMapHighlightLayers';
// Mock Canvas and CanvasRenderingContext2D
const mockGetContext = jest.fn();
// Mock canvas methods
const mockCtx = {
    fillStyle: '',
    fillRect: jest.fn(),
    strokeStyle: '',
    lineWidth: 1,
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    clearRect: jest.fn(),
    rect: jest.fn(),
    arc: jest.fn(),
    closePath: jest.fn(),
    clip: jest.fn(),
    measureText: jest.fn().mockReturnValue({ width: 50 }),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    strokeRect: jest.fn(),
    createLinearGradient: jest.fn(),
    createRadialGradient: jest.fn(),
    setLineDash: jest.fn(),
    getLineDash: jest.fn(),
    lineDashOffset: 0,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'inherit',
};
beforeEach(() => {
    mockGetContext.mockReturnValue(mockCtx);
    // Mock canvas element properly
    HTMLCanvasElement.prototype.getContext = mockGetContext;
    // Mock canvas size properties
    Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
        value: 800,
        writable: true,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
        value: 600,
        writable: true,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
        value: 800,
        writable: true,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
        value: 600,
        writable: true,
    });
});
afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
});
describe('ArchitectureMapHighlightLayers', () => {
    const mockCityData = {
        buildings: [
            {
                path: 'src/main.ts',
                position: { x: 10, y: 0, z: 10 },
                dimensions: [10, 20, 10],
                type: 'file',
                fileExtension: '.ts',
            },
            {
                path: 'src/components/Button.tsx',
                position: { x: 30, y: 0, z: 10 },
                dimensions: [10, 15, 10],
                type: 'file',
                fileExtension: '.tsx',
            },
        ],
        districts: [
            {
                path: 'src',
                worldBounds: { minX: 0, maxX: 50, minZ: 0, maxZ: 30 },
                fileCount: 2,
                type: 'directory',
            },
            {
                path: 'src/components',
                worldBounds: { minX: 25, maxX: 45, minZ: 5, maxZ: 25 },
                fileCount: 1,
                type: 'directory',
            },
        ],
        bounds: { minX: 0, maxX: 50, minZ: 0, maxZ: 30 },
        metadata: {
            totalFiles: 2,
            totalDirectories: 2,
            analyzedAt: new Date(),
            rootPath: '/project',
        },
    };
    const mockHighlightLayers = [
        {
            id: 'test-layer',
            name: 'Test Layer',
            enabled: true,
            color: '#ff0000',
            priority: 1,
            items: [{ path: 'src/main.ts', type: 'file' }],
        },
    ];
    it('should render without crashing', () => {
        const { container } = render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData }));
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
    });
    it('should render with city data', () => {
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, highlightLayers: mockHighlightLayers }));
        expect(mockGetContext).toHaveBeenCalledWith('2d');
        expect(mockCtx.fillRect).toHaveBeenCalled();
    });
    it('should display "No city data available" when no data provided', () => {
        render(_jsx(ArchitectureMapHighlightLayers, {}));
        expect(screen.getByText('No city data available')).toBeInTheDocument();
    });
    it('should show layer controls when enabled', () => {
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, highlightLayers: mockHighlightLayers, showLayerControls: true }));
        expect(screen.getByText('Test Layer')).toBeInTheDocument();
    });
    it('should handle layer toggle', () => {
        const onLayerToggle = jest.fn();
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, highlightLayers: mockHighlightLayers, showLayerControls: true, onLayerToggle: onLayerToggle }));
        const layerButton = screen.getByText('Test Layer');
        fireEvent.click(layerButton);
        expect(onLayerToggle).toHaveBeenCalledWith('test-layer', false);
    });
    it('should handle mouse events', async () => {
        const onFileClick = jest.fn();
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, onFileClick: onFileClick }));
        const interactionLayer = document.querySelector('div[style*="cursor"]');
        expect(interactionLayer).toBeInTheDocument();
        if (interactionLayer) {
            fireEvent.mouseMove(interactionLayer, { clientX: 100, clientY: 100 });
            fireEvent.click(interactionLayer);
        }
    });
    it('should handle zoom and pan interactions', () => {
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData }));
        const interactionLayer = document.querySelector('div[style*="cursor"]');
        expect(interactionLayer).toBeInTheDocument();
        if (interactionLayer) {
            // Test mouse down (start dragging)
            fireEvent.mouseDown(interactionLayer, { clientX: 100, clientY: 100 });
            // Test mouse move (dragging)
            fireEvent.mouseMove(interactionLayer, { clientX: 150, clientY: 150 });
            // Test mouse up (stop dragging)
            fireEvent.mouseUp(interactionLayer);
            // Test wheel (zoom)
            fireEvent.wheel(interactionLayer, { deltaY: -100 });
        }
    });
    it('should apply transformations', () => {
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, transform: {
                rotation: 90,
                flipHorizontal: true,
                flipVertical: false,
            } }));
        const container = document.querySelector('div[style*="transform"]');
        expect(container).toBeInTheDocument();
    });
    it('should handle fullSize prop', () => {
        const { rerender } = render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, fullSize: false }));
        rerender(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, fullSize: true }));
        // Component should re-render without errors
        expect(mockCtx.fillRect).toHaveBeenCalled();
    });
    it('should handle custom colors', () => {
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, canvasBackgroundColor: "#000000", defaultBuildingColor: "#ffffff", defaultDirectoryColor: "#cccccc", hoverBorderColor: "#ff0000" }));
        expect(mockCtx.fillRect).toHaveBeenCalled();
    });
    it('should handle selective rendering', () => {
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, selectiveRender: {
                mode: 'filter',
                directories: new Set(['src']),
            } }));
        expect(mockCtx.fillRect).toHaveBeenCalled();
    });
    it('should handle subdirectory mode', () => {
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, subdirectoryMode: {
                enabled: true,
                rootPath: 'src',
                autoCenter: true,
            } }));
        expect(mockCtx.fillRect).toHaveBeenCalled();
    });
    it('should handle mouse leave', () => {
        render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData }));
        const interactionLayer = document.querySelector('div[style*="cursor"]');
        if (interactionLayer) {
            fireEvent.mouseLeave(interactionLayer);
        }
        // Should not crash
        expect(mockCtx.fillRect).toHaveBeenCalled();
    });
    describe('props validation', () => {
        it('should handle undefined props gracefully', () => {
            render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, highlightLayers: undefined, onLayerToggle: undefined }));
            expect(mockCtx.fillRect).toHaveBeenCalled();
        });
        it('should handle empty highlight layers', () => {
            render(_jsx(ArchitectureMapHighlightLayers, { cityData: mockCityData, highlightLayers: [] }));
            expect(mockCtx.fillRect).toHaveBeenCalled();
        });
    });
});

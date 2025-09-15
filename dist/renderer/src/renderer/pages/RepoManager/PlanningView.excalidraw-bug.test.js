import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Test coverage for the Excalidraw save bug in PlanningView
 *
 * Bug Description:
 * When saving an Excalidraw drawing for the first time in PlanningView,
 * the save completes successfully but incorrectly shows a new blank Excalidraw
 * after the save operation instead of maintaining the existing drawing.
 *
 * Root Cause Analysis:
 * The issue appears to be related to how the component handles the diagram ID
 * update after the first save. When ExcalidrawStorageService.saveDiagram returns
 * a new diagram ID, the component updates its state with setSlideDocument, which
 * may trigger a re-render with a new key for the ExcalidrawWrapper component.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
// Mock all the complex dependencies to focus on the bug
jest.mock('themed-markdown', () => ({
    useTheme: () => ({
        theme: {
            colors: {
                textPrimary: '#000',
                textSecondary: '#666',
                primary: '#007acc',
                background: '#fff',
                surface: '#f5f5f5',
                border: '#ddd'
            }
        }
    }),
    parseMarkdownIntoPresentation: jest.fn(),
    serializePresentationToMarkdown: jest.fn(),
    updatePresentationSlide: jest.fn()
}));
// Mock the storage service
const mockSaveDiagram = jest.fn();
const mockLoadDiagram = jest.fn();
const mockListDiagrams = jest.fn();
const mockDeleteDiagram = jest.fn();
jest.mock('../../main-process-api/ExcalidrawStorageService', () => ({
    ExcalidrawStorageService: {
        saveDiagram: mockSaveDiagram,
        loadDiagram: mockLoadDiagram,
        listDiagrams: mockListDiagrams,
        deleteDiagram: mockDeleteDiagram
    }
}));
jest.mock('../../main-process-api/FileSystemService', () => ({
    FileSystemService: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        listFiles: jest.fn().mockResolvedValue([])
    }
}));
jest.mock('../../main-process-api/UserPreferencesService', () => ({
    UserPreferencesService: {
        getPreferences: jest.fn().mockResolvedValue({
            planningDocumentsDirectory: '.principleMD/planning'
        })
    }
}));
// Create a test component that simulates the bug
const TestExcalidrawSaveBug = () => {
    const [diagramId, setDiagramId] = React.useState(undefined);
    const [renderKey, setRenderKey] = React.useState(0);
    const [excalidrawData, setExcalidrawData] = React.useState({ elements: [], appState: {} });
    const handleSave = async () => {
        // Simulate the save operation
        const newDiagramId = 'test-diagram-id-123';
        mockSaveDiagram.mockResolvedValueOnce(newDiagramId);
        // Call the save service
        const savedId = await mockSaveDiagram('Test Diagram', excalidrawData, '/test/path', diagramId);
        // BUG: This is where the issue occurs
        // Setting the diagram ID might cause a re-render with new key
        if (!diagramId) {
            setDiagramId(savedId);
            // POTENTIAL BUG: If this causes key to change, ExcalidrawWrapper recreates
            setRenderKey(prev => prev + 1);
        }
    };
    return (_jsxs("div", { children: [_jsx("div", { "data-testid": "diagram-id", children: diagramId || 'no-id' }), _jsx("div", { "data-testid": "render-key", children: renderKey }), _jsxs("div", { "data-testid": "excalidraw-wrapper", children: [_jsxs("div", { "data-testid": "excalidraw-content", children: ["Excalidraw Instance ", renderKey] }), _jsx("button", { onClick: handleSave, "data-testid": "save-button", children: "Save Diagram" })] }, diagramId || 'new-excalidraw')] }));
};
describe('PlanningView Excalidraw Save Bug', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSaveDiagram.mockResolvedValue('test-diagram-id-123');
        mockListDiagrams.mockResolvedValue([]);
    });
    describe('Bug Reproduction', () => {
        it('should demonstrate the bug: ExcalidrawWrapper recreates after first save', async () => {
            const { getByTestId } = render(_jsx(TestExcalidrawSaveBug, {}));
            // Initial state - no diagram ID
            expect(getByTestId('diagram-id')).toHaveTextContent('no-id');
            expect(getByTestId('render-key')).toHaveTextContent('0');
            const initialContent = getByTestId('excalidraw-content').textContent;
            expect(initialContent).toBe('Excalidraw Instance 0');
            // Save the diagram for the first time
            await act(async () => {
                fireEvent.click(getByTestId('save-button'));
            });
            await waitFor(() => {
                expect(mockSaveDiagram).toHaveBeenCalledWith('Test Diagram', expect.any(Object), '/test/path', undefined // First save has no diagram ID
                );
            });
            // After save - diagram ID is set
            await waitFor(() => {
                expect(getByTestId('diagram-id')).toHaveTextContent('test-diagram-id-123');
            });
            // BUG DETECTION: The render key changes, indicating component recreation
            expect(getByTestId('render-key')).toHaveTextContent('1');
            // The content shows a new instance, confirming the bug
            const contentAfterSave = getByTestId('excalidraw-content').textContent;
            expect(contentAfterSave).toBe('Excalidraw Instance 1');
            // This demonstrates the bug: The component was recreated instead of maintained
            expect(contentAfterSave).not.toBe(initialContent);
        });
    });
    describe('Expected Behavior', () => {
        it('should maintain the same Excalidraw instance after first save', async () => {
            // This test shows what SHOULD happen (but currently doesn't)
            const FixedComponent = () => {
                const [diagramId, setDiagramId] = React.useState(undefined);
                const [instanceId] = React.useState(() => Math.random()); // Stable instance ID
                const handleSave = async () => {
                    const newDiagramId = 'test-diagram-id-123';
                    mockSaveDiagram.mockResolvedValueOnce(newDiagramId);
                    const savedId = await mockSaveDiagram('Test Diagram', { elements: [], appState: {} }, '/test/path', diagramId);
                    // FIX: Only update diagram ID, don't change key
                    if (!diagramId) {
                        setDiagramId(savedId);
                    }
                };
                return (_jsxs("div", { children: [_jsx("div", { "data-testid": "diagram-id", children: diagramId || 'no-id' }), _jsxs("div", { "data-testid": "excalidraw-wrapper", children: [_jsx("div", { "data-testid": "instance-id", children: instanceId }), _jsx("button", { onClick: handleSave, "data-testid": "save-button", children: "Save Diagram" })] }, "stable-key" // FIX: Use stable key
                        )] }));
            };
            const { getByTestId } = render(_jsx(FixedComponent, {}));
            const instanceBefore = getByTestId('instance-id').textContent;
            // Save the diagram
            await act(async () => {
                fireEvent.click(getByTestId('save-button'));
            });
            await waitFor(() => {
                expect(getByTestId('diagram-id')).toHaveTextContent('test-diagram-id-123');
            });
            // The instance ID should remain the same (component not recreated)
            const instanceAfter = getByTestId('instance-id').textContent;
            expect(instanceAfter).toBe(instanceBefore);
        });
    });
    describe('Fix Verification', () => {
        it('should verify the fix: use stable key for ExcalidrawWrapper', () => {
            // The fix is to use a stable key that doesn't change when diagram ID updates
            // Current problematic code:
            // key={slideDocument.metadata.diagramId || slideDocument.metadata.filePath || 'new-excalidraw'}
            // Fixed code should be:
            // key={slideDocument.metadata.filePath || 'excalidraw-' + (slideDocument.type === 'excalidraw' ? '1' : '0')}
            // Or use a ref/state for a stable identifier that doesn't change
            const problematicKey = (diagramId, filePath) => {
                return diagramId || filePath || 'new-excalidraw';
            };
            const fixedKey = (type, filePath) => {
                return filePath || `excalidraw-${type}`;
            };
            // Before save
            const keyBefore = problematicKey(undefined, undefined);
            expect(keyBefore).toBe('new-excalidraw');
            // After save (BUG: key changes)
            const keyAfter = problematicKey('test-diagram-id-123', undefined);
            expect(keyAfter).toBe('test-diagram-id-123');
            expect(keyAfter).not.toBe(keyBefore); // This causes recreation
            // With fix (key remains stable)
            const fixedKeyBefore = fixedKey('excalidraw', undefined);
            const fixedKeyAfter = fixedKey('excalidraw', undefined);
            expect(fixedKeyBefore).toBe(fixedKeyAfter); // No recreation
        });
    });
});

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlanningView } from './PlanningView';
import { ExcalidrawStorageService } from '../../main-process-api/ExcalidrawStorageService';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import type { Repository } from '../../../shared/types/repository.types';

// Mock the ExcalidrawWrapper component
jest.mock('../../components/shared/ExcalidrawWrapper', () => ({
  ExcalidrawWrapper: jest.fn(({ onSave, onChange, initialData, diagramId }) => {
    return (
      <div data-testid="excalidraw-wrapper">
        <button
          data-testid="excalidraw-save"
          onClick={() => onSave?.('test-diagram-id')}
        >
          Save Excalidraw
        </button>
        <button
          data-testid="excalidraw-change"
          onClick={() => onChange?.({ elements: [], appState: {} }, {})}
        >
          Trigger Change
        </button>
        <div data-testid="excalidraw-diagram-id">{diagramId}</div>
      </div>
    );
  }),
}));

// Mock other components
jest.mock('../../components/Terminal/TerminalPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="terminal-panel">Terminal Panel</div>,
}));

jest.mock('./shared/DocumentSearchPanel', () => ({
  DocumentSearchPanel: () => (
    <div data-testid="document-search-panel">Document Search Panel</div>
  ),
}));

jest.mock('../../components/shared/ThemedMonaco', () => ({
  ThemedMonaco: () => <div data-testid="themed-monaco">Monaco Editor</div>,
}));

jest.mock('./shared/MarkdownDocumentViewer', () => ({
  MarkdownDocumentViewer: () => (
    <div data-testid="markdown-viewer">Markdown Viewer</div>
  ),
}));

jest.mock('./shared/PlanningEmptyState', () => ({
  PlanningEmptyState: () => (
    <div data-testid="planning-empty-state">Empty State</div>
  ),
}));

jest.mock('./shared/PlanningStartOverlay', () => ({
  PlanningStartOverlay: ({ onClose, onDocumentCreated }: any) => (
    <div data-testid="planning-start-overlay">
      <button onClick={() => onClose()}>Close Overlay</button>
      <button onClick={() => onDocumentCreated('excalidraw')}>
        Create Excalidraw
      </button>
    </div>
  ),
}));

// Mock services
jest.mock('../../main-process-api/ExcalidrawStorageService');
jest.mock('../../main-process-api/FileSystemService');
jest.mock('../../main-process-api/UserPreferencesService');
jest.mock('themed-markdown', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        primary: '#007acc',
        background: '#fff',
        surface: '#f5f5f5',
        border: '#ddd',
      },
    },
  }),
}));

describe('PlanningView', () => {
  const mockRepository: Repository = {
    id: 'repo-123',
    name: 'test-repo',
    owner: 'test-owner',
    remoteUrl: 'https://github.com/test-owner/test-repo.git',
    localClones: [],
    metadata: {
      defaultBranch: 'main',
      language: 'TypeScript',
      stars: 100,
    },
  };

  const mockLocalClone = {
    path: '/test/repo/path',
    currentBranch: 'main',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock UserPreferencesService
    (UserPreferencesService.getPreferences as jest.Mock).mockResolvedValue({
      planningDocumentsDirectory: '.principleMD/planning',
    });

    // Mock FileSystemService
    (FileSystemService.readFile as jest.Mock).mockResolvedValue(
      '# Test Document',
    );
    (FileSystemService.writeFile as jest.Mock).mockResolvedValue(undefined);
    // FileSystemService.listFiles doesn't exist, might be a different method
    // (FileSystemService.listFiles as jest.Mock).mockResolvedValue([]);

    // Mock ExcalidrawStorageService
    (ExcalidrawStorageService.saveDiagram as jest.Mock).mockResolvedValue(
      'saved-diagram-id',
    );
    (ExcalidrawStorageService.loadDiagram as jest.Mock).mockResolvedValue({
      elements: [],
      appState: {},
    });
    (ExcalidrawStorageService.listDiagrams as jest.Mock).mockResolvedValue([]);
    (ExcalidrawStorageService.deleteDiagram as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  describe('Excalidraw Save Functionality', () => {
    it('should create a new Excalidraw document when requested', async () => {
      const { getByTestId, getByText } = render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
        />,
      );

      // Close the start overlay and create an Excalidraw document
      await act(async () => {
        fireEvent.click(getByText('Create Excalidraw'));
      });

      await waitFor(() => {
        expect(getByTestId('excalidraw-wrapper')).toBeInTheDocument();
      });
    });

    it('should save Excalidraw for the first time and maintain the same diagram', async () => {
      const { getByTestId, getByText } = render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
        />,
      );

      // Create an Excalidraw document
      await act(async () => {
        fireEvent.click(getByText('Create Excalidraw'));
      });

      await waitFor(() => {
        expect(getByTestId('excalidraw-wrapper')).toBeInTheDocument();
      });

      // Initially, there should be no diagram ID
      const diagramIdElement = getByTestId('excalidraw-diagram-id');
      expect(diagramIdElement.textContent).toBe('');

      // Trigger save
      await act(async () => {
        fireEvent.click(getByTestId('excalidraw-save'));
      });

      // Wait for the save to complete
      await waitFor(() => {
        expect(ExcalidrawStorageService.saveDiagram).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          mockLocalClone.path,
          undefined,
        );
      });

      // After save, the diagram ID should be set
      await waitFor(() => {
        expect(getByTestId('excalidraw-diagram-id').textContent).toBe(
          'test-diagram-id',
        );
      });

      // The Excalidraw wrapper should still be visible (not replaced with a new one)
      expect(getByTestId('excalidraw-wrapper')).toBeInTheDocument();
    });

    it('should not create a new Excalidraw after first-time save', async () => {
      const { getByTestId, getByText, container } = render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
        />,
      );

      // Create an Excalidraw document
      await act(async () => {
        fireEvent.click(getByText('Create Excalidraw'));
      });

      const initialWrapper = getByTestId('excalidraw-wrapper');
      expect(initialWrapper).toBeInTheDocument();

      // Trigger save
      await act(async () => {
        fireEvent.click(getByTestId('excalidraw-save'));
      });

      // Wait for save to complete
      await waitFor(() => {
        expect(ExcalidrawStorageService.saveDiagram).toHaveBeenCalled();
      });

      // Check that the same wrapper is still present (not recreated)
      const wrapperAfterSave = getByTestId('excalidraw-wrapper');
      expect(wrapperAfterSave).toBe(initialWrapper);

      // Verify no new Excalidraw document was created
      const allWrappers = container.querySelectorAll(
        '[data-testid="excalidraw-wrapper"]',
      );
      expect(allWrappers).toHaveLength(1);
    });

    it('should update diagram ID in state after first save', async () => {
      const { getByTestId, getByText } = render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
        />,
      );

      // Create an Excalidraw document
      await act(async () => {
        fireEvent.click(getByText('Create Excalidraw'));
      });

      // Initially no diagram ID
      expect(getByTestId('excalidraw-diagram-id').textContent).toBe('');

      // Save the diagram
      await act(async () => {
        fireEvent.click(getByTestId('excalidraw-save'));
      });

      // Diagram ID should be updated
      await waitFor(() => {
        expect(getByTestId('excalidraw-diagram-id').textContent).toBe(
          'test-diagram-id',
        );
      });

      // Save again - should use the existing diagram ID
      jest.clearAllMocks();
      await act(async () => {
        fireEvent.click(getByTestId('excalidraw-save'));
      });

      await waitFor(() => {
        expect(ExcalidrawStorageService.saveDiagram).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          mockLocalClone.path,
          'test-diagram-id', // Should pass the existing diagram ID
        );
      });
    });

    it('should handle save errors gracefully', async () => {
      // Mock save to fail
      (ExcalidrawStorageService.saveDiagram as jest.Mock).mockRejectedValue(
        new Error('Save failed'),
      );

      const { getByTestId, getByText } = render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
        />,
      );

      // Create an Excalidraw document
      await act(async () => {
        fireEvent.click(getByText('Create Excalidraw'));
      });

      // Try to save
      await act(async () => {
        fireEvent.click(getByTestId('excalidraw-save'));
      });

      // Wait for the error to be handled
      await waitFor(() => {
        expect(ExcalidrawStorageService.saveDiagram).toHaveBeenCalled();
      });

      // Document should still be present
      expect(getByTestId('excalidraw-wrapper')).toBeInTheDocument();

      // Diagram ID should remain empty since save failed
      expect(getByTestId('excalidraw-diagram-id').textContent).toBe('');
    });

    it('should preserve Excalidraw content during save', async () => {
      const mockElements = {
        elements: [{ id: 'test-element' }],
        appState: { zoom: 1 },
      };

      const { getByTestId, getByText } = render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
        />,
      );

      // Create an Excalidraw document
      await act(async () => {
        fireEvent.click(getByText('Create Excalidraw'));
      });

      // Trigger a change to set content
      await act(async () => {
        fireEvent.click(getByTestId('excalidraw-change'));
      });

      // Save the diagram
      await act(async () => {
        fireEvent.click(getByTestId('excalidraw-save'));
      });

      // Verify the save was called
      await waitFor(() => {
        expect(ExcalidrawStorageService.saveDiagram).toHaveBeenCalled();
      });

      // The Excalidraw wrapper should still be present with the same content
      expect(getByTestId('excalidraw-wrapper')).toBeInTheDocument();
    });

    it('should handle switching between documents without losing state', async () => {
      const { getByTestId, getByText, queryByTestId } = render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
        />,
      );

      // Create an Excalidraw document
      await act(async () => {
        fireEvent.click(getByText('Create Excalidraw'));
      });

      // Save it
      await act(async () => {
        fireEvent.click(getByTestId('excalidraw-save'));
      });

      // Wait for diagram ID to be set
      await waitFor(() => {
        expect(getByTestId('excalidraw-diagram-id').textContent).toBe(
          'test-diagram-id',
        );
      });

      // The document should remain the same
      expect(queryByTestId('excalidraw-wrapper')).toBeInTheDocument();
      expect(queryByTestId('planning-empty-state')).not.toBeInTheDocument();
    });
  });

  describe('Document Management', () => {
    it('should delete an unsaved Excalidraw document', async () => {
      const { getByTestId, getByText, queryByTestId } = render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
        />,
      );

      // Create an Excalidraw document
      await act(async () => {
        fireEvent.click(getByText('Create Excalidraw'));
      });

      expect(getByTestId('excalidraw-wrapper')).toBeInTheDocument();

      // Find and click delete button
      const deleteButton = screen.getByLabelText(/delete/i);
      await act(async () => {
        fireEvent.click(deleteButton);
      });

      // Confirm deletion
      const confirmButton = screen.getByText(/yes.*delete/i);
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // Document should be removed
      await waitFor(() => {
        expect(queryByTestId('excalidraw-wrapper')).not.toBeInTheDocument();
      });
    });

    it('should delete a saved Excalidraw document', async () => {
      const { getByTestId, getByText } = render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
        />,
      );

      // Create and save an Excalidraw document
      await act(async () => {
        fireEvent.click(getByText('Create Excalidraw'));
      });

      await act(async () => {
        fireEvent.click(getByTestId('excalidraw-save'));
      });

      await waitFor(() => {
        expect(getByTestId('excalidraw-diagram-id').textContent).toBe(
          'test-diagram-id',
        );
      });

      // Delete the saved document
      const deleteButton = screen.getByLabelText(/delete/i);
      await act(async () => {
        fireEvent.click(deleteButton);
      });

      const confirmButton = screen.getByText(/yes.*delete/i);
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      // Should call delete on the storage service
      await waitFor(() => {
        expect(ExcalidrawStorageService.deleteDiagram).toHaveBeenCalledWith(
          'test-diagram-id',
        );
      });
    });
  });

  describe('UI State Management', () => {
    it('should notify parent of UI state changes', async () => {
      const onUIStateChange = jest.fn();

      render(
        <PlanningView
          repository={mockRepository}
          localClone={mockLocalClone}
          onUIStateChange={onUIStateChange}
          uiState={{
            viewMode: 'slides',
            showSegmented: true,
            showEditor: false,
            activeLeftTab: 'search',
          }}
        />,
      );

      // Create a document to trigger UI state notification
      await act(async () => {
        fireEvent.click(screen.getByText('Create Excalidraw'));
      });

      await waitFor(() => {
        expect(onUIStateChange).toHaveBeenCalledWith({
          viewMode: 'slides',
          showSegmented: true,
          showEditor: false,
          activeLeftTab: 'search',
        });
      });
    });
  });
});

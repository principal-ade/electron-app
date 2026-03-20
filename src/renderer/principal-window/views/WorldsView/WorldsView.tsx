import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ConfigurablePanelLayout } from '@principal-ade/panels';
import { UserCollectionsPanel, LocalProjectsPanel } from '@industry-theme/alexandria-panels';
import { CollectionMapPanel } from '@industry-theme/repository-composition-panels';
import { Map, FolderOpen, Folder } from 'lucide-react';
import {
  WorldsViewPanelProvider,
  useWorldsViewPanelProvider,
} from '../../../contexts/WorldsViewPanelContext';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import { WorldsViewHeader } from './WorldsViewHeader';
import { CreateCollectionModal } from '../../../components/CreateCollectionModal';

/**
 * Inner content component that uses the panel context
 */
const WorldsViewContent: React.FC = () => {
  const { theme } = useTheme();
  const { context, actions, events } = useWorldsViewPanelProvider();

  // State for create collection modal
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] =
    useState(false);

  // State for panel collapse
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(true);

  // Panel persistence (must be called BEFORE any early returns)
  const panelState = usePanelPersistence({
    viewKey: 'worldsView',
    defaultSizes: { left: 25, middle: 50, right: 25 },
    collapsed: { left: false, right: isRightPanelCollapsed },
    panelType: 'three-panel',
  });

  // Handle create collection modal close
  const handleCloseCreateCollectionModal = useCallback(() => {
    setIsCreateCollectionModalOpen(false);
  }, []);

  // Handle collection created successfully - refresh the collections list
  const handleCollectionCreated = useCallback(async () => {
    // Refresh collections slice
    await context.refresh(undefined, 'userCollections');
  }, [context]);

  // Handle create collection
  const handleCreateCollection = useCallback(
    async (name: string, description?: string, icon?: string): Promise<void> => {
      if (actions.createCollection) {
        await actions.createCollection(name, description, icon);
      }
    },
    [actions]
  );

  // Listen for create-collection-requested events from UserCollectionsPanel
  useEffect(() => {
    const unsubscribe = events.on(
      'industry-theme.user-collections:create-collection-requested',
      () => {
        setIsCreateCollectionModalOpen(true);
      }
    );

    return unsubscribe;
  }, [events]);

  // useMemo must be called unconditionally - define panels even if we're in loading state
  const panels = useMemo(
    () => [
      {
        id: 'collections',
        label: 'Collections',
        icon: <FolderOpen size={16} />,
        content: (
          <UserCollectionsPanel
            context={context}
            actions={actions}
            events={events}
          />
        ),
      },
      {
        id: 'overworld-map',
        label: 'Overworld Map',
        icon: <Map size={16} />,
        content: (
          <CollectionMapPanel
            context={context}
            actions={actions}
            events={events}
          />
        ),
      },
      {
        id: 'local-projects',
        label: 'Local Projects',
        icon: <Folder size={16} />,
        content: (
          <LocalProjectsPanel
            context={context}
            actions={actions}
            events={events}
            defaultShowSearch
          />
        ),
      },
    ],
    [context, actions, events],
  );

  const layout = useMemo(() => {
    return {
      left: 'collections',
      middle: 'overworld-map',
      right: 'local-projects',
    };
  }, []);

  // Safety check AFTER all hooks - also check if theme is properly loaded (not just transparent placeholders)
  if (!theme || !context || !actions || !events || !theme.colors || theme.colors.text === 'transparent') {
    return (
      <div style={{ padding: '24px', color: '#666' }}>
        Loading Worlds view...
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors?.background || '#ffffff',
        }}
      >
        <WorldsViewHeader
          isRightPanelCollapsed={isRightPanelCollapsed}
          onToggleRightPanel={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
        />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ConfigurablePanelLayout
            panels={panels}
            layout={layout}
            collapsed={{
              left: panelState.collapsed.left ?? false,
              middle: false,
              right: isRightPanelCollapsed,
            }}
            onRightCollapseComplete={panelState.type === 'three-panel' ? panelState.handleRightCollapseComplete : undefined}
            onRightExpandComplete={panelState.type === 'three-panel' ? panelState.handleRightExpandComplete : undefined}
            theme={theme}
          />
        </div>
      </div>

      {/* Create Collection Modal */}
      <CreateCollectionModal
        isOpen={isCreateCollectionModalOpen}
        onClose={handleCloseCreateCollectionModal}
        onSuccess={handleCollectionCreated}
        onCreateCollection={handleCreateCollection}
      />
    </>
  );
};

/**
 * WorldsView - Main view for visualizing collections as overworld maps
 */
export const WorldsView: React.FC = () => {
  return (
    <WorldsViewPanelProvider>
      <WorldsViewContent />
    </WorldsViewPanelProvider>
  );
};

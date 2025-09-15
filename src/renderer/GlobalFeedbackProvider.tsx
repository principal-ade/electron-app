import React, { useEffect, useState, createContext, useContext } from 'react';
import { FeedbackModal } from './components/FeedbackModal';
import { detectReactComponent, enableComponentNameDisplay } from './utils/componentDetection';
import { FeedbackService } from './main-process-api/FeedbackService';

interface FeedbackContextValue {
  showFeedback: (componentInfo: any) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
};

interface GlobalFeedbackProviderProps {
  children: React.ReactNode;
}

export const GlobalFeedbackProvider: React.FC<GlobalFeedbackProviderProps> = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    componentInfo: {
      componentName: '',
      componentPath: '',
      elementInfo: '',
    },
  });

  useEffect(() => {
    // Enable component name display in development
    enableComponentNameDisplay();
    
    // Global context menu handler
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Use enhanced component detection
      const componentInfo = detectReactComponent(target);
      let elementInfo = '';
      if (target.className.split) {
        elementInfo = `${target.tagName.toLowerCase()}.${target.className.split(' ').join('.')}`;
      }
      
      // Send to main process with component detection
      FeedbackService.showContextMenu({
        x: e.clientX,
        y: e.clientY,
        componentName: componentInfo.name,
        componentPath: componentInfo.path,
        elementInfo,
      });
    };

    // Add global listener with option to prevent default
    document.addEventListener('contextmenu', handleContextMenu);

    // Listen for feedback modal show event from main process
    const unsubscribe = FeedbackService.onShowModal((data) => {
      setModalState({
        isOpen: true,
        componentInfo: {
          ...data,
          additionalData: {
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
            url: window.location.href,
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      unsubscribe();
    };
  }, []);

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const showFeedback = (componentInfo: any) => {
    setModalState({
      isOpen: true,
      componentInfo,
    });
  };

  return (
    <FeedbackContext.Provider value={{ showFeedback }}>
      {children}
      <FeedbackModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        componentInfo={modalState.componentInfo}
      />
    </FeedbackContext.Provider>
  );
};
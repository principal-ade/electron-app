import { useEffect, useRef, useState, useCallback } from 'react';
import { FeedbackModal } from '../components/FeedbackModal';
import { FeedbackService } from '../main-process-api/FeedbackService';

interface FeedbackModalState {
  isOpen: boolean;
  componentInfo: {
    componentName: string;
    componentPath: string;
    elementInfo: string;
    screenshot?: string;
    additionalData?: Record<string, any>;
  };
}

export function useFeedbackContextMenu(
  componentName: string,
  componentPath: string,
) {
  const ref = useRef<HTMLElement>(null);
  const [modalState, setModalState] = useState<FeedbackModalState>({
    isOpen: false,
    componentInfo: {
      componentName,
      componentPath,
      elementInfo: '',
    },
  });

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();

      const target = e.target as HTMLElement;
      const elementInfo = `${target.tagName.toLowerCase()}${target.className ? `.${target.className.split(' ').join('.')}` : ''}`;

      // Send context menu request to main process
      FeedbackService.showContextMenu({
        x: e.clientX,
        y: e.clientY,
        componentName,
        componentPath,
        elementInfo,
      });
    },
    [componentName, componentPath],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Add context menu listener
    element.addEventListener('contextmenu', handleContextMenu);

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
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    return () => {
      element.removeEventListener('contextmenu', handleContextMenu);
      unsubscribe();
    };
  }, [handleContextMenu]);

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const FeedbackModalComponent = () => (
    <FeedbackModal
      isOpen={modalState.isOpen}
      onClose={closeModal}
      componentInfo={modalState.componentInfo}
    />
  );

  return {
    ref,
    FeedbackModal: FeedbackModalComponent,
  };
}

import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback } from 'react';
import { FeedbackModal } from '../components/FeedbackModal';
import { FeedbackService } from '../main-process-api/FeedbackService';
export function useFeedbackContextMenu(componentName, componentPath) {
    const ref = useRef(null);
    const [modalState, setModalState] = useState({
        isOpen: false,
        componentInfo: {
            componentName,
            componentPath,
            elementInfo: '',
        },
    });
    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        const target = e.target;
        const elementInfo = `${target.tagName.toLowerCase()}${target.className ? `.${target.className.split(' ').join('.')}` : ''}`;
        // Send context menu request to main process
        FeedbackService.showContextMenu({
            x: e.clientX,
            y: e.clientY,
            componentName,
            componentPath,
            elementInfo,
        });
    }, [componentName, componentPath]);
    useEffect(() => {
        const element = ref.current;
        if (!element)
            return;
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
        setModalState(prev => ({ ...prev, isOpen: false }));
    };
    const FeedbackModalComponent = () => (_jsx(FeedbackModal, { isOpen: modalState.isOpen, onClose: closeModal, componentInfo: modalState.componentInfo }));
    return {
        ref,
        FeedbackModal: FeedbackModalComponent,
    };
}

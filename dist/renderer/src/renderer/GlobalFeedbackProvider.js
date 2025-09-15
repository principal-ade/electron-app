import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, createContext, useContext } from 'react';
import { FeedbackModal } from './components/FeedbackModal';
import { detectReactComponent, enableComponentNameDisplay } from './utils/componentDetection';
import { FeedbackService } from './main-process-api/FeedbackService';
const FeedbackContext = createContext(null);
export const useFeedback = () => {
    const context = useContext(FeedbackContext);
    if (!context) {
        throw new Error('useFeedback must be used within FeedbackProvider');
    }
    return context;
};
export const GlobalFeedbackProvider = ({ children }) => {
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
        const handleContextMenu = (e) => {
            const target = e.target;
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
    const showFeedback = (componentInfo) => {
        setModalState({
            isOpen: true,
            componentInfo,
        });
    };
    return (_jsxs(FeedbackContext.Provider, { value: { showFeedback }, children: [children, _jsx(FeedbackModal, { isOpen: modalState.isOpen, onClose: closeModal, componentInfo: modalState.componentInfo })] }));
};

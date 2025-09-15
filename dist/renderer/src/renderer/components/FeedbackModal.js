import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X } from 'lucide-react';
export const FeedbackModal = ({ isOpen, onClose, componentInfo, }) => {
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackType, setFeedbackType] = useState('bug');
    if (!isOpen)
        return null;
    const handleSubmit = () => {
        const feedbackData = {
            ...componentInfo,
            feedbackText,
            feedbackType,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
        };
        console.log('Feedback data to send:', feedbackData);
        // TODO: Wire this up to send feedback to your backend
        onClose();
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden", children: [_jsx("div", { className: "p-6 border-b border-gray-200 dark:border-gray-700", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900 dark:text-white", children: "Component Feedback" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: _jsx(X, { size: 24 }) })] }) }), _jsx("div", { className: "p-6 overflow-y-auto max-h-[calc(90vh-180px)]", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-medium text-gray-700 dark:text-gray-300 mb-2", children: "Component Information" }), _jsxs("div", { className: "bg-gray-100 dark:bg-gray-900 p-4 rounded-md space-y-2 text-sm font-mono", children: [_jsxs("p", { children: [_jsx("span", { className: "text-gray-500", children: "Component:" }), " ", componentInfo.componentName] }), _jsxs("p", { children: [_jsx("span", { className: "text-gray-500", children: "Path:" }), " ", componentInfo.componentPath] }), _jsxs("p", { children: [_jsx("span", { className: "text-gray-500", children: "Element:" }), " ", componentInfo.elementInfo] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2", children: "Feedback Type" }), _jsxs("select", { value: feedbackType, onChange: (e) => setFeedbackType(e.target.value), className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white", children: [_jsx("option", { value: "bug", children: "Bug Report" }), _jsx("option", { value: "feature", children: "Feature Request" }), _jsx("option", { value: "improvement", children: "Improvement Suggestion" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2", children: "Your Feedback" }), _jsx("textarea", { value: feedbackText, onChange: (e) => setFeedbackText(e.target.value), rows: 5, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white", placeholder: "Describe the issue or suggestion..." })] }), componentInfo.screenshot && (_jsxs("div", { children: [_jsx("h3", { className: "font-medium text-gray-700 dark:text-gray-300 mb-2", children: "Screenshot" }), _jsx("img", { src: componentInfo.screenshot, alt: "Component screenshot", className: "max-w-full rounded-md border border-gray-300 dark:border-gray-600" })] }))] }) }), _jsxs("div", { className: "p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors", children: "Cancel" }), _jsx("button", { onClick: handleSubmit, disabled: !feedbackText.trim(), className: "px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed", children: "Submit Feedback" })] })] }) }));
};

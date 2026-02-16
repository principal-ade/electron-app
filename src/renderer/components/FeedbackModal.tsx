import React, { useState } from 'react';
import { X } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentInfo: {
    componentName: string;
    componentPath: string;
    elementInfo: string;
    screenshot?: string;
    additionalData?: Record<string, unknown>;
  };
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  componentInfo,
}) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<
    'bug' | 'feature' | 'improvement'
  >('bug');

  if (!isOpen) return null;

  const handleSubmit = () => {
    const feedbackData = {
      ...componentInfo,
      feedbackText,
      feedbackType,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    console.info('Feedback data to send:', feedbackData);
    // TODO: Wire this up to send feedback to your backend
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Component Feedback
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Component Information
              </h3>
              <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md space-y-2 text-sm font-mono">
                <p>
                  <span className="text-gray-500">Component:</span>{' '}
                  {componentInfo.componentName}
                </p>
                <p>
                  <span className="text-gray-500">Path:</span>{' '}
                  {componentInfo.componentPath}
                </p>
                <p>
                  <span className="text-gray-500">Element:</span>{' '}
                  {componentInfo.elementInfo}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Feedback Type
              </label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="improvement">Improvement Suggestion</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Feedback
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Describe the issue or suggestion..."
              />
            </div>

            {componentInfo.screenshot && (
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Screenshot
                </h3>
                <img
                  src={componentInfo.screenshot}
                  alt="Component screenshot"
                  className="max-w-full rounded-md border border-gray-300 dark:border-gray-600"
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!feedbackText.trim()}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Feedback
          </button>
        </div>
      </div>
    </div>
  );
};

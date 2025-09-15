import React, { useState } from 'react';
import {
  ValidationCommand,
  CommandResult,
} from '../../../shared/validation-types';

interface CommandCardProps {
  command: ValidationCommand;
  isRunning?: boolean;
  lastResult?: CommandResult;
  onEdit: (commandId: string) => void;
  onTest: (commandId: string) => void;
  onDelete: (commandId: string) => void;
}

const StatusBadge: React.FC<{ status: CommandResult['status'] }> = ({
  status,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failure':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'timeout':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'skipped':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return '✅';
      case 'failure':
        return '❌';
      case 'timeout':
        return '⏱️';
      case 'skipped':
        return '⏭️';
      default:
        return '❓';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor()}`}
    >
      <span className="mr-1">{getStatusIcon()}</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const CommandCard: React.FC<CommandCardProps> = ({
  command,
  isRunning = false,
  lastResult,
  onEdit,
  onTest,
  onDelete,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };

  return (
    <div
      className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${
        lastResult?.status === 'failure'
          ? 'border-red-200'
          : lastResult?.status === 'success'
            ? 'border-green-200'
            : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {command.name}
            </h3>
            <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
              <span>Timeout: {command.timeout || 'Default'}ms</span>
              <span>Retries: {command.retries || 0}</span>
              <span>
                Continue on failure: {command.continueOnFailure ? '✅' : '❌'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            {lastResult && <StatusBadge status={lastResult.status} />}

            <button
              onClick={() => onTest(command.id)}
              disabled={isRunning}
              className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white transition-colors ${
                isRunning
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isRunning ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Running...
                </>
              ) : (
                <>
                  <svg
                    className="-ml-1 mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1m-6 4h6"
                    />
                  </svg>
                  Test
                </>
              )}
            </button>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className={`h-5 w-5 transform transition-transform ${showDetails ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <div className="relative">
              <button
                onClick={() => onEdit(command.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            </div>

            <button
              onClick={() => onDelete(command.id)}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Command Details */}
      {showDetails && (
        <div className="p-4 bg-gray-50 border-b border-gray-100">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Command
              </label>
              <code className="block w-full p-2 bg-gray-900 text-green-400 text-sm font-mono rounded border">
                {command.command}
              </code>
            </div>

            {command.workingDirectory && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Working Directory
                </label>
                <code className="block w-full p-2 bg-gray-100 text-gray-800 text-sm font-mono rounded border">
                  {command.workingDirectory}
                </code>
              </div>
            )}

            {command.environment &&
              Object.keys(command.environment).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Environment Variables
                  </label>
                  <div className="bg-gray-100 rounded border p-2">
                    {Object.entries(command.environment).map(([key, value]) => (
                      <div key={key} className="text-sm font-mono">
                        <span className="text-blue-600">{key}</span>=
                        <span className="text-green-600">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Last Result */}
      {lastResult && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">
              Last Test Result
            </h4>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Duration: {formatDuration(lastResult.duration)}</span>
              <span>Exit Code: {lastResult.exitCode}</span>
              {lastResult.retryCount > 0 && (
                <span>Retries: {lastResult.retryCount}</span>
              )}
            </div>
          </div>

          {(lastResult.stdout || lastResult.stderr) && (
            <div className="space-y-2">
              <button
                onClick={() => setShowOutput(!showOutput)}
                className="flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                <svg
                  className={`mr-1 h-4 w-4 transform transition-transform ${showOutput ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                {showOutput ? 'Hide' : 'Show'} Output
              </button>

              {showOutput && (
                <div className="space-y-2">
                  {lastResult.stdout && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Standard Output
                      </label>
                      <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded border overflow-x-auto max-h-40 overflow-y-auto">
                        {lastResult.stdout}
                      </pre>
                    </div>
                  )}

                  {lastResult.stderr && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Standard Error
                      </label>
                      <pre className="bg-red-900 text-red-200 text-xs p-3 rounded border overflow-x-auto max-h-40 overflow-y-auto">
                        {lastResult.stderr}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!showOutput && lastResult.stdout && (
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1">Output Preview:</div>
              <div className="bg-gray-100 text-gray-700 text-xs p-2 rounded border font-mono">
                {truncateText(lastResult.stdout)}
              </div>
            </div>
          )}

          {lastResult.error && (
            <div className="mt-2">
              <div className="text-xs text-red-700 mb-1">Error:</div>
              <div className="bg-red-50 text-red-800 text-xs p-2 rounded border">
                {lastResult.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommandCard;

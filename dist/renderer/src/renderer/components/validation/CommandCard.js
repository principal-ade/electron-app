import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
const StatusBadge = ({ status, }) => {
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
    return (_jsxs("span", { className: `inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor()}`, children: [_jsx("span", { className: "mr-1", children: getStatusIcon() }), status.charAt(0).toUpperCase() + status.slice(1)] }));
};
const CommandCard = ({ command, isRunning = false, lastResult, onEdit, onTest, onDelete, }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [showOutput, setShowOutput] = useState(false);
    const formatDuration = (ms) => {
        if (ms < 1000)
            return `${ms}ms`;
        if (ms < 60000)
            return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };
    const truncateText = (text, maxLength = 100) => {
        if (text.length <= maxLength)
            return text;
        return `${text.substring(0, maxLength)}...`;
    };
    return (_jsxs("div", { className: `bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${lastResult?.status === 'failure'
            ? 'border-red-200'
            : lastResult?.status === 'success'
                ? 'border-green-200'
                : 'border-gray-200'}`, children: [_jsx("div", { className: "p-4 border-b border-gray-100", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 truncate", children: command.name }), _jsxs("div", { className: "mt-1 flex items-center space-x-4 text-sm text-gray-500", children: [_jsxs("span", { children: ["Timeout: ", command.timeout || 'Default', "ms"] }), _jsxs("span", { children: ["Retries: ", command.retries || 0] }), _jsxs("span", { children: ["Continue on failure: ", command.continueOnFailure ? '✅' : '❌'] })] })] }), _jsxs("div", { className: "flex items-center space-x-2 ml-4", children: [lastResult && _jsx(StatusBadge, { status: lastResult.status }), _jsx("button", { onClick: () => onTest(command.id), disabled: isRunning, className: `inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white transition-colors ${isRunning
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`, children: isRunning ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-2 h-4 w-4 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Running..."] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { className: "-ml-1 mr-2 h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1m-6 4h6" }) }), "Test"] })) }), _jsx("button", { onClick: () => setShowDetails(!showDetails), className: "text-gray-400 hover:text-gray-600 transition-colors", children: _jsx("svg", { className: `h-5 w-5 transform transition-transform ${showDetails ? 'rotate-180' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M19 9l-7 7-7-7" }) }) }), _jsx("div", { className: "relative", children: _jsx("button", { onClick: () => onEdit(command.id), className: "text-gray-400 hover:text-gray-600 transition-colors", children: _jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" }) }) }) }), _jsx("button", { onClick: () => onDelete(command.id), className: "text-red-400 hover:text-red-600 transition-colors", children: _jsx("svg", { className: "h-5 w-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) })] })] }) }), showDetails && (_jsx("div", { className: "p-4 bg-gray-50 border-b border-gray-100", children: _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Command" }), _jsx("code", { className: "block w-full p-2 bg-gray-900 text-green-400 text-sm font-mono rounded border", children: command.command })] }), command.workingDirectory && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Working Directory" }), _jsx("code", { className: "block w-full p-2 bg-gray-100 text-gray-800 text-sm font-mono rounded border", children: command.workingDirectory })] })), command.environment &&
                            Object.keys(command.environment).length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Environment Variables" }), _jsx("div", { className: "bg-gray-100 rounded border p-2", children: Object.entries(command.environment).map(([key, value]) => (_jsxs("div", { className: "text-sm font-mono", children: [_jsx("span", { className: "text-blue-600", children: key }), "=", _jsx("span", { className: "text-green-600", children: value })] }, key))) })] }))] }) })), lastResult && (_jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h4", { className: "text-sm font-medium text-gray-900", children: "Last Test Result" }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-500", children: [_jsxs("span", { children: ["Duration: ", formatDuration(lastResult.duration)] }), _jsxs("span", { children: ["Exit Code: ", lastResult.exitCode] }), lastResult.retryCount > 0 && (_jsxs("span", { children: ["Retries: ", lastResult.retryCount] }))] })] }), (lastResult.stdout || lastResult.stderr) && (_jsxs("div", { className: "space-y-2", children: [_jsxs("button", { onClick: () => setShowOutput(!showOutput), className: "flex items-center text-sm text-blue-600 hover:text-blue-700", children: [_jsx("svg", { className: `mr-1 h-4 w-4 transform transition-transform ${showOutput ? 'rotate-90' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M9 5l7 7-7 7" }) }), showOutput ? 'Hide' : 'Show', " Output"] }), showOutput && (_jsxs("div", { className: "space-y-2", children: [lastResult.stdout && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-gray-700 mb-1", children: "Standard Output" }), _jsx("pre", { className: "bg-gray-900 text-green-400 text-xs p-3 rounded border overflow-x-auto max-h-40 overflow-y-auto", children: lastResult.stdout })] })), lastResult.stderr && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-gray-700 mb-1", children: "Standard Error" }), _jsx("pre", { className: "bg-red-900 text-red-200 text-xs p-3 rounded border overflow-x-auto max-h-40 overflow-y-auto", children: lastResult.stderr })] }))] }))] })), !showOutput && lastResult.stdout && (_jsxs("div", { className: "mt-2", children: [_jsx("div", { className: "text-xs text-gray-500 mb-1", children: "Output Preview:" }), _jsx("div", { className: "bg-gray-100 text-gray-700 text-xs p-2 rounded border font-mono", children: truncateText(lastResult.stdout) })] })), lastResult.error && (_jsxs("div", { className: "mt-2", children: [_jsx("div", { className: "text-xs text-red-700 mb-1", children: "Error:" }), _jsx("div", { className: "bg-red-50 text-red-800 text-xs p-2 rounded border", children: lastResult.error })] }))] }))] }));
};
export default CommandCard;

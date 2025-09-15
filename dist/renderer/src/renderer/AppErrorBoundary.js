import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { defaultTheme as theme } from 'themed-markdown';
import { SystemService } from './main-process-api/SystemService';
export class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (_jsx("div", { className: "min-h-screen flex items-center justify-center p-8", style: {
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text
                }, children: _jsxs("div", { className: "max-w-md text-center", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "Something went wrong" }), _jsx("p", { className: "mb-4", style: { color: theme.colors.textSecondary }, children: "An unexpected error occurred. Please try refreshing the page." }), this.state.error && (_jsxs("details", { className: "text-left p-4 rounded-lg", style: { backgroundColor: theme.colors.surface }, children: [_jsx("summary", { className: "cursor-pointer mb-2", children: "Error details" }), _jsxs("pre", { className: "text-xs overflow-auto text-red-400", children: [this.state.error.message, '\n', this.state.error.stack] })] })), _jsx("button", { onClick: () => SystemService.restartApp(), className: "mt-6 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg", children: "Refresh Page" })] }) }));
        }
        return this.props.children;
    }
}

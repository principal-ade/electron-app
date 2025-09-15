import { jsx as _jsx } from "react/jsx-runtime";
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useTheme } from 'themed-markdown';
// Configure Monaco to use the locally bundled version
loader.config({ monaco });
// Configure workers when in browser
if (typeof window !== 'undefined') {
    window.MonacoEnvironment = {
        getWorkerUrl: (_moduleId, label) => {
            if (label === 'json')
                return './json.worker.js';
            if (label === 'css' || label === 'scss' || label === 'less')
                return './css.worker.js';
            if (label === 'html' || label === 'handlebars' || label === 'razor')
                return './html.worker.js';
            if (label === 'typescript' || label === 'javascript')
                return './ts.worker.js';
            return './editor.worker.js';
        }
    };
}
function useMonacoTheme() {
    const { theme } = useTheme();
    try {
        const bgColor = theme.colors?.background;
        if (bgColor && typeof bgColor === 'string') {
            const colorStr = bgColor.toLowerCase();
            if (colorStr.startsWith('#')) {
                const hex = colorStr.slice(1);
                if (hex.length >= 6) {
                    const r = parseInt(hex.slice(0, 2), 16);
                    const g = parseInt(hex.slice(2, 4), 16);
                    const b = parseInt(hex.slice(4, 6), 16);
                    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    return luminance < 0.5 ? 'vs-dark' : 'vs';
                }
            }
        }
    }
    catch { }
    return 'vs-dark';
}
export const ThemedMonaco = ({ value, onChange, readOnly = false, language = 'plaintext', height = '100%' }) => {
    const monacoTheme = useMonacoTheme();
    const { theme } = useTheme();
    return (_jsx(Editor, { height: height, language: language, theme: monacoTheme, value: value, onChange: (v) => onChange?.(v || ''), options: {
            readOnly,
            wordWrap: 'on',
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
        }, loading: _jsx("div", { style: { color: theme.colors.textSecondary, padding: 8 }, children: "Loading editor\u2026" }) }));
};

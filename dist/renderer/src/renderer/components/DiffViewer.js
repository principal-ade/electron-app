import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'themed-markdown';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { GitService } from '../main-process-api/GitService';
// Configure Monaco to use the locally bundled version
loader.config({ monaco });
export const DiffViewer = ({ filePath, repositoryPath, gitStatus, }) => {
    const { theme } = useTheme();
    const [originalContent, setOriginalContent] = useState('');
    const [modifiedContent, setModifiedContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const diffEditorRef = useRef(null);
    useEffect(() => {
        const loadDiff = async () => {
            try {
                setIsLoading(true);
                setError(null);
                // Load current file content
                const currentContent = await FileSystemService.readFile(filePath);
                setModifiedContent(currentContent);
                if (gitStatus === 'added' || gitStatus === 'untracked') {
                    // For new files, show empty original
                    setOriginalContent('');
                }
                else if (gitStatus === 'deleted') {
                    // For deleted files, get content from HEAD
                    const result = await GitService.execCommand(repositoryPath, ['show', `HEAD:${filePath}`]);
                    setOriginalContent(result?.stdout || '');
                    setModifiedContent(''); // File is deleted
                }
                else {
                    // For modified files, get content from HEAD
                    try {
                        const result = await GitService.execCommand(repositoryPath, ['show', `HEAD:${filePath}`]);
                        setOriginalContent(result?.stdout || '');
                    }
                    catch (err) {
                        // File might not exist in HEAD
                        console.warn('Failed to get HEAD version:', err);
                        setOriginalContent('');
                    }
                }
            }
            catch (error) {
                console.error('Error loading diff:', error);
                setError(error instanceof Error ? error.message : 'Failed to load diff');
            }
            finally {
                setIsLoading(false);
            }
        };
        loadDiff();
    }, [filePath, repositoryPath, gitStatus]);
    const handleEditorDidMount = (editor) => {
        diffEditorRef.current = editor;
        // Configure theme
        monaco.editor.defineTheme('principleTheme', {
            base: theme.colors.backgroundPrimary === '#1a1a1a' ? 'vs-dark' : 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': theme.colors.background,
                'editor.foreground': theme.colors.text,
                'editor.lineHighlightBackground': theme.colors.backgroundSecondary,
                'editorLineNumber.foreground': theme.colors.textSecondary,
                'editorGutter.background': theme.colors.backgroundSecondary,
                'diffEditor.insertedTextBackground': '#10b98133',
                'diffEditor.removedTextBackground': '#ef444433',
            }
        });
        monaco.editor.setTheme('principleTheme');
    };
    if (isLoading) {
        return (_jsx("div", { style: {
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.textSecondary,
            }, children: "Loading diff..." }));
    }
    if (error) {
        return (_jsxs("div", { style: {
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.error,
            }, children: ["Error: ", error] }));
    }
    // Determine file language
    const getLanguage = (path) => {
        const ext = path.split('.').pop()?.toLowerCase();
        const languageMap = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'json': 'json',
            'md': 'markdown',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'py': 'python',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
            'go': 'go',
            'rs': 'rust',
            'swift': 'swift',
            'kt': 'kotlin',
            'rb': 'ruby',
            'php': 'php',
            'sh': 'shell',
            'bash': 'shell',
            'yaml': 'yaml',
            'yml': 'yaml',
            'toml': 'toml',
            'xml': 'xml',
            'sql': 'sql',
        };
        return languageMap[ext || ''] || 'plaintext';
    };
    return (_jsx(Editor, { height: "100%", defaultLanguage: getLanguage(filePath), original: originalContent, modified: modifiedContent, onMount: handleEditorDidMount, options: {
            readOnly: true,
            renderSideBySide: true,
            enableSplitViewResizing: true,
            originalEditable: false,
            fontSize: 13,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            minimap: {
                enabled: true,
            },
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            renderWhitespace: 'boundary',
            diffWordWrap: 'off',
        }, theme: "principleTheme" }));
};

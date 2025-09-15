import { createElement as _createElement } from "react";
import { useEffect, useState } from 'react';
import { FileViewer } from '../../../components/FileViewer';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
export const WatchingFileViewer = (props) => {
    const { filePath } = props;
    const [fileKey, setFileKey] = useState(0);
    useEffect(() => {
        let cleanup = null;
        const setupWatching = async () => {
            try {
                console.log('Watching file:', filePath);
                // Start watching the file
                await FileSystemService.watchFile(filePath);
                // Set up the file change listener
                cleanup = FileSystemService.onFileChange((event) => {
                    if (event.path === filePath) {
                        console.log('File changed externally, reloading:', filePath);
                        // Force FileViewer to re-mount and reload content
                        setFileKey((prev) => prev + 1);
                    }
                });
            }
            catch (error) {
                console.error('Error setting up file watching:', error);
            }
        };
        setupWatching();
        // Cleanup on unmount or when filePath changes
        return () => {
            if (cleanup) {
                cleanup();
            }
            FileSystemService.stopWatchingFile(filePath).catch(console.error);
        };
    }, [filePath]);
    return (_createElement(FileViewer, { ...props, key: `${filePath}-${fileKey}` }));
};

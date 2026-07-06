import React from 'react';
import { MediaViewerPanel } from './MediaViewerPanel';

interface MediaTabContentProps {
  filePath: string;
  fileName: string;
}

export const MediaTabContent: React.FC<MediaTabContentProps> = ({
  filePath,
  fileName,
}) => (
  <div
    style={{
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <MediaViewerPanel filePath={filePath} fileName={fileName} />
  </div>
);

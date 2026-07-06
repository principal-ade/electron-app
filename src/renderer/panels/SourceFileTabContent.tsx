import React from 'react';
import { PierreFileView } from './PierreFileView';

interface SourceFileTabContentProps {
  filePath: string;
  fileName: string;
}

export const SourceFileTabContent: React.FC<SourceFileTabContentProps> = ({
  filePath,
  fileName,
}) => (
  <div
    style={{
      height: '100%',
      width: '100%',
      overflow: 'auto',
      position: 'relative',
    }}
  >
    <PierreFileView filePath={filePath} fileName={fileName} />
  </div>
);

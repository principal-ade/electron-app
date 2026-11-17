/**
 * Drop target behavior for ACP artifact drags.
 *
 * The ACP panel has three independent drop zones (messages, right activity
 * panel, composer). They share this hook and differ only in what they do with
 * the artifact after it is read.
 */
import { useCallback, useState } from 'react';
import type React from 'react';
import type { AcpArtifactAssociation } from '../../../shared/main-process-api-interfaces/AcpAPI';
import {
  hasAcpArtifactDrag,
  readAcpArtifactDrag,
} from '../../utils/acpArtifactDrag';

export interface AcpArtifactDragHandlers {
  onDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
}

export interface AcpArtifactDropState {
  isDragOver: boolean;
  dragHandlers: AcpArtifactDragHandlers;
}

export function useAcpArtifactDrop(
  onDropArtifact: (artifact: AcpArtifactAssociation) => void,
): AcpArtifactDropState {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasAcpArtifactDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasAcpArtifactDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const artifact = readAcpArtifactDrag(event.dataTransfer);
      if (!artifact) return;
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      onDropArtifact(artifact);
    },
    [onDropArtifact],
  );

  return {
    isDragOver,
    dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}

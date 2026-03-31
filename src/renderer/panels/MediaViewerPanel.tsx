/**
 * MediaViewerPanel
 *
 * Panel for viewing media files (images and videos) in a tab.
 * Supports:
 * - Images: PNG, JPG, JPEG, GIF, WebP, SVG, BMP, ICO
 * - Videos: MP4, WebM, MOV, AVI, MKV, OGV
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';

export interface MediaViewerPanelProps {
  /** Absolute path to the media file */
  filePath: string;
  /** File name for display */
  fileName: string;
}

const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|avi|mkv|ogv)$/i;

export const MediaViewerPanel: React.FC<MediaViewerPanelProps> = ({
  filePath,
  fileName,
}) => {
  const { theme } = useTheme();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaType = useMemo(() => {
    if (IMAGE_EXTENSIONS.test(fileName)) return 'image';
    if (VIDEO_EXTENSIONS.test(fileName)) return 'video';
    return 'unknown';
  }, [fileName]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setRotation(0);
  }, []);

  const handleMediaError = useCallback(() => {
    setError(`Failed to load ${mediaType}: ${fileName}`);
  }, [fileName, mediaType]);

  // Use local-media:// protocol which is registered in main process
  // This bypasses Chromium's security restrictions on file:// URLs
  // Using localhost as explicit host prevents path being interpreted as hostname
  const mediaUrl = `local-media://localhost${filePath}`;

  const isImage = mediaType === 'image';
  const isVideo = mediaType === 'video';

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      {/* Toolbar - only show zoom/rotate controls for images */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        {isImage && (
          <>
            <button
              onClick={handleZoomOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: 4,
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
              }}
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <span
              style={{
                fontSize: 12,
                color: theme.colors.textSecondary,
                minWidth: 48,
                textAlign: 'center',
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: 4,
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
              }}
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
            <div
              style={{
                width: 1,
                height: 16,
                backgroundColor: theme.colors.border,
                margin: '0 4px',
              }}
            />
            <button
              onClick={handleRotate}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: 4,
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
              }}
              title="Rotate 90°"
            >
              <RotateCw size={16} />
            </button>
            <button
              onClick={handleReset}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: 4,
                backgroundColor: 'transparent',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
              }}
              title="Reset view"
            >
              <Maximize2 size={16} />
            </button>
            <div
              style={{
                width: 1,
                height: 16,
                backgroundColor: theme.colors.border,
                margin: '0 4px',
              }}
            />
          </>
        )}
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 12,
            color: theme.colors.textMuted,
          }}
        >
          {fileName}
        </span>
      </div>

      {/* Media container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          padding: 16,
          // Checkerboard pattern for transparency (images only)
          ...(isImage && {
            backgroundImage: `
              linear-gradient(45deg, ${theme.colors.backgroundTertiary} 25%, transparent 25%),
              linear-gradient(-45deg, ${theme.colors.backgroundTertiary} 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, ${theme.colors.backgroundTertiary} 75%),
              linear-gradient(-45deg, transparent 75%, ${theme.colors.backgroundTertiary} 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }),
          // Dark background for videos
          ...(isVideo && {
            backgroundColor: theme.colors.backgroundTertiary,
          }),
        }}
      >
        {error ? (
          <div
            style={{
              color: theme.colors.error,
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        ) : isImage ? (
          <img
            src={mediaUrl}
            alt={fileName}
            onError={handleMediaError}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease',
            }}
            draggable={false}
          />
        ) : isVideo ? (
          <video
            src={mediaUrl}
            controls
            onError={handleMediaError}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              outline: 'none',
            }}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div
            style={{
              color: theme.colors.textMuted,
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            Unsupported media type
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaViewerPanel;

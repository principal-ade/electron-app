import React from 'react';

export type WindowCardProps = {
  id: number;
  title: string;
  thumbnail?: string;
  isSelected: boolean;
  onClick: () => void;
};

export const WindowCard: React.FC<WindowCardProps> = ({
  title,
  thumbnail,
  isSelected,
  onClick,
}) => {
  const displayTitle = title?.trim() || 'Untitled Window';

  return (
    <button
      type="button"
      className={`window-card${isSelected ? ' selected' : ''}`}
      onClick={onClick}
    >
      <div className="window-preview">
        {thumbnail ? (
          <img src={thumbnail} alt="" />
        ) : (
          <svg
            className="window-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        )}
      </div>
      <span className="window-title" title={displayTitle}>
        {displayTitle}
      </span>
    </button>
  );
};

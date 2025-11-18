import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  delay = 500,
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const spacing = 8;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - spacing;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + spacing;
        break;
    }

    // Keep tooltip within viewport
    const padding = 10;
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - tooltipRect.width - padding),
    );
    top = Math.max(
      padding,
      Math.min(top, window.innerHeight - tooltipRect.height - padding),
    );

    setPosition({ top, left });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 10000,
            pointerEvents: 'none',
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundTertiary,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              whiteSpace: 'nowrap',
              maxWidth: '250px',
            }}
          >
            {content}
            <div
              style={{
                position: 'absolute',
                width: '8px',
                height: '8px',
                backgroundColor: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderTop: 'none',
                borderLeft: 'none',
                transform: 'rotate(45deg)',
                ...(placement === 'top' && {
                  bottom: '-5px',
                  left: '50%',
                  marginLeft: '-4px',
                }),
                ...(placement === 'bottom' && {
                  top: '-5px',
                  left: '50%',
                  marginLeft: '-4px',
                  borderTop: `1px solid ${theme.colors.border}`,
                  borderLeft: `1px solid ${theme.colors.border}`,
                  borderBottom: 'none',
                  borderRight: 'none',
                }),
                ...(placement === 'left' && {
                  right: '-5px',
                  top: '50%',
                  marginTop: '-4px',
                }),
                ...(placement === 'right' && {
                  left: '-5px',
                  top: '50%',
                  marginTop: '-4px',
                  borderTop: `1px solid ${theme.colors.border}`,
                  borderLeft: `1px solid ${theme.colors.border}`,
                  borderBottom: 'none',
                  borderRight: 'none',
                }),
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

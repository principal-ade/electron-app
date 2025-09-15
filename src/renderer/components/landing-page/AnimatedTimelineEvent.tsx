import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from 'themed-markdown';
import {
  Sparkles,
  Wrench,
  Edit3,
  Trash2,
  Globe,
  StopCircle,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { SessionEventType } from '../../../shared/sessionEnums';

interface AnimatedTimelineEventProps {
  event: {
    type: SessionEventType;
    timestamp: number;
    data: any;
  };
  isNew?: boolean;
  isSelected?: boolean;
  renderContent: (event: any, timeStr: string) => React.ReactNode;
}

const AnimatedTimelineEventComponent: React.FC<AnimatedTimelineEventProps> = ({
  event,
  isNew = false,
  isSelected = false,
  renderContent,
}) => {
  const { theme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(isNew);
  const [showBorder, setShowBorder] = useState(!isNew);
  const [showContent, setShowContent] = useState(!isNew);
  const timeStr = new Date(event.timestamp).toLocaleTimeString();
  const elementRef = useRef<HTMLDivElement>(null);

  // Get session color if available
  const sessionColor = (event as any).agentColor;

  useEffect(() => {
    if (isNew) {
      setIsAnimating(true);
      setShowBorder(false);
      setShowContent(false);

      // Scroll into view
      setTimeout(() => {
        elementRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
      }, 50);

      // Show border first
      setTimeout(() => {
        setShowBorder(true);
      }, 100);

      // Then show content with typing effect
      setTimeout(() => {
        setShowContent(true);
      }, 300);

      // End animation
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const getEventIcon = () => {
    switch (event.type) {
      case 'tool':
        return {
          icon: <Wrench size={12} />,
          bg: `${theme.colors.primary}20`,
          pulse: theme.colors.primary,
        };
      case 'file-read':
        return {
          icon: '📖',
          bg: `${theme.colors.success}20`,
          pulse: theme.colors.success,
        };
      case 'file-write':
        if (event.data.write?.operation === 'create') {
          return {
            icon: <Sparkles size={12} />,
            bg: `${theme.colors.success}20`,
            pulse: theme.colors.success,
          };
        }
        if (event.data.write?.operation === 'delete') {
          return {
            icon: <Trash2 size={12} />,
            bg: `${theme.colors.error}20`,
            pulse: theme.colors.error,
          };
        }
        return {
          icon: <Edit3 size={12} />,
          bg: `${theme.colors.warning}20`,
          pulse: theme.colors.warning,
        };
      case 'web':
        return {
          icon: <Globe size={12} />,
          bg: `${theme.colors.secondary}20`,
          pulse: theme.colors.secondary,
        };
      case 'stop':
        return {
          icon: <StopCircle size={12} />,
          bg: `${theme.colors.error}20`,
          pulse: theme.colors.error,
        };
      case 'grouped':
        return {
          icon: <FileText size={12} />,
          bg: `${theme.colors.primary}20`,
          pulse: theme.colors.primary,
        };
      default:
        return {
          icon: <HelpCircle size={12} />,
          bg: `${theme.colors.muted}20`,
          pulse: theme.colors.textTertiary,
        };
    }
  };

  const { icon, bg, pulse } = getEventIcon();

  // Add CSS animations if not already defined
  React.useEffect(() => {
    const styleId = 'timeline-event-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }
        @keyframes borderAppear {
          from {
            opacity: 0;
            transform: scaleY(0.8);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
        }
        @keyframes typewriter {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .typing-content {
          animation: typewriter 0.3s ease-out forwards;
        }
        .typing-content > * {
          animation: typewriter 0.2s ease-out forwards;
          opacity: 0;
        }
        .typing-content > *:nth-child(1) { animation-delay: 0s; }
        .typing-content > *:nth-child(2) { animation-delay: 0.1s; }
        .typing-content > *:nth-child(3) { animation-delay: 0.2s; }
        .typing-content > *:nth-child(4) { animation-delay: 0.3s; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div
      ref={elementRef}
      style={{
        backgroundColor: showBorder
          ? theme.colors.backgroundSecondary
          : 'transparent',
        borderRadius: '6px',
        padding: showBorder ? '10px 12px' : '0',
        transition: 'all 0.5s',
        transform: isAnimating ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isAnimating
          ? `0 4px 12px -2px ${sessionColor || theme.colors.primary}33`
          : 'none',
        animation: showBorder ? 'borderAppear 0.3s ease-out' : 'none',
        border: showBorder
          ? sessionColor
            ? `2px solid ${sessionColor}`
            : `1px solid ${theme.colors.border}`
          : '2px solid transparent',
        borderLeftWidth: showBorder && sessionColor ? '4px' : '2px',
        borderColor: isSelected
          ? theme.colors.primary
          : showBorder
            ? sessionColor || theme.colors.border
            : 'transparent',
        boxShadow: isSelected
          ? `0 0 0 2px ${theme.colors.primary}40`
          : isAnimating
            ? `0 4px 12px -2px ${sessionColor || theme.colors.primary}33`
            : 'none',
        minHeight: '32px',
        opacity: showBorder ? 1 : 0,
      }}
    >
      <div
        className={showContent ? 'typing-content' : ''}
        style={{ opacity: showContent ? 1 : 0 }}
      >
        {renderContent(event, timeStr)}
      </div>
    </div>
  );
};

export const AnimatedTimelineEvent = React.memo(
  AnimatedTimelineEventComponent,
  (prevProps, nextProps) => {
    // Only re-render if event ID, isNew flag, isSelected, or event data changes
    return (
      prevProps.event.id === nextProps.event.id &&
      prevProps.isNew === nextProps.isNew &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.event.timestamp === nextProps.event.timestamp
    );
  },
);

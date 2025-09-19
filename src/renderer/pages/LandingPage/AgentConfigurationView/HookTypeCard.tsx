import React from 'react';
import {
  Wrench,
  StopCircle,
  Bell,
  Layers,
  FileText,
  Globe,
  Edit3,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface HookTypeCardProps {
  type: string;
  count: number;
  configured: boolean;
  color: string;
  onClick: () => void;
  description?: string;
}

export const HookTypeCard: React.FC<HookTypeCardProps> = ({
  type,
  count,
  configured,
  color,
  onClick,
  description,
}) => {
  const { theme } = useTheme();
  const getIcon = () => {
    // Map hook types to appropriate icons
    const iconMap: Record<string, React.ReactNode> = {
      'Post Tool Use': <Wrench size={24} />,
      'Pre Tool Use': <Wrench size={24} />,
      Stop: <StopCircle size={24} />,
      'Session Stop': <StopCircle size={24} />,
      'Subagent Stop': <StopCircle size={24} />,
      Notification: <Bell size={24} />,
      'Pre Compact': <Layers size={24} />,
      'Tool Call': <Wrench size={24} />,
      'File Read': <FileText size={24} />,
      'File Edited': <Edit3 size={24} />,
      'Web Access': <Globe size={24} />,
    };
    return iconMap[type] || <Wrench size={24} />;
  };

  return (
    <button
      onClick={onClick}
      className="rounded-lg p-6 transition-all text-left group relative overflow-hidden"
      style={{
        backgroundColor: theme.colors.surface,
        //'&:hover': { backgroundColor: theme.colors.backgroundHover }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = theme.colors.backgroundHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = theme.colors.surface;
      }}
    >
      {/* Background gradient on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, transparent 100%)`,
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <span className="text-2xl">{getIcon()}</span>
          </div>

          <div className="text-right">
            {configured ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: theme.colors.success }}
                />
                <span
                  className="text-sm"
                  style={{ color: theme.colors.success }}
                >
                  Configured
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: theme.colors.warning }}
                />
                <span
                  className="text-sm"
                  style={{ color: theme.colors.warning }}
                >
                  Not configured
                </span>
              </div>
            )}
          </div>
        </div>

        <h3
          className="text-lg font-semibold mb-1"
          style={{ color: theme.colors.text }}
        >
          {type}
        </h3>
        <p
          className="text-sm mb-3"
          style={{ color: theme.colors.textSecondary }}
        >
          {description || 'Configure hooks for this event'}
        </p>

        <div className="flex items-center justify-between">
          <span
            className="text-sm"
            style={{ color: theme.colors.textTertiary }}
          >
            {count} hook{count !== 1 ? 's' : ''} configured
          </span>
          <svg
            className="w-5 h-5 transition-colors"
            style={{ color: theme.colors.textSecondary }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </button>
  );
};

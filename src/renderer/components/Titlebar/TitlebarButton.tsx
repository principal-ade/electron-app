import { useTheme } from '@principal-ade/industry-theme';

export interface TitlebarButtonProps {
  onClick?: () => void;
  icon: React.ReactNode;
  ariaLabel: string;
  title?: string;
  position?: 'left' | 'right';
  badge?: boolean;
  badgeColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const TitlebarButton: React.FC<TitlebarButtonProps> = ({
  onClick,
  icon,
  ariaLabel,
  title,
  position = 'right',
  badge = false,
  badgeColor,
  className = '',
  style,
}) => {
  const { theme, mode } = useTheme();
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const buttonPosition =
    position === 'right'
      ? { right: isMac ? '16px' : '150px' }
      : { left: isMac ? '80px' : '16px' };

  return (
    <button
      onClick={onClick}
      className={`titlebar-action-button ${className}`}
      style={{
        position: 'absolute',
        ...buttonPosition,
        top: '50%',
        transform: 'translateY(-50%)',
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: 'transparent',
        color: theme.colors.textSecondary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        WebkitAppRegion: 'no-drag' as 'no-drag',
        zIndex: 10,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor =
          mode === 'dark'
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.color = theme.colors.text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = theme.colors.textSecondary;
      }}
      aria-label={ariaLabel}
      title={title}
    >
      {icon}
      {badge && (
        <div
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: badgeColor || theme.colors.warning || '#fbbf24',
            boxShadow: `0 0 4px ${badgeColor || theme.colors.warning || '#fbbf24'}80`,
          }}
        />
      )}
    </button>
  );
};

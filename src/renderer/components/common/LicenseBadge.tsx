import React from 'react';
import { Shield, FileText } from 'lucide-react';
import { getLicenseColor, getLicenseDisplayName } from '../../utils/licenseUtils';

interface LicenseBadgeProps {
  license: {
    key: string;
    name?: string;
    spdxId?: string;
    url?: string;
  };
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  interactive?: boolean;
  iconType?: 'shield' | 'file';
  showFullName?: boolean;
}

export const LicenseBadge: React.FC<LicenseBadgeProps> = ({
  license,
  size = 'medium',
  onClick,
  interactive = false,
  iconType = 'shield',
  showFullName = false,
}) => {
  const isClickable = interactive && onClick;
  
  // Size configurations
  const sizeConfig = {
    small: {
      padding: '3px 8px',
      fontSize: '11px',
      iconSize: 11,
      borderRadius: '6px',
      gap: '4px',
    },
    medium: {
      padding: '4px 10px',
      fontSize: '13px',
      iconSize: 12,
      borderRadius: '6px',
      gap: '6px',
    },
    large: {
      padding: '6px 12px',
      fontSize: '14px',
      iconSize: 14,
      borderRadius: '8px',
      gap: '6px',
    },
  };
  
  const config = sizeConfig[size];
  const color = getLicenseColor(license.key);
  const displayName = showFullName 
    ? (license.name || license.spdxId || 'License')
    : getLicenseDisplayName(license);
  
  const Icon = iconType === 'shield' ? Shield : FileText;
  
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: config.gap,
    padding: config.padding,
    borderRadius: config.borderRadius,
    backgroundColor: `${color}15`,
    border: `1px solid ${color}40`,
    fontSize: config.fontSize,
    fontWeight: size === 'small' ? 600 : 500,
    color: color,
    transition: isClickable ? 'all 0.2s' : undefined,
    cursor: isClickable ? 'pointer' : 'default',
    userSelect: 'none',
  };
  
  const [hover, setHover] = React.useState(false);
  
  const dynamicStyle: React.CSSProperties = hover && isClickable ? {
    backgroundColor: `${color}25`,
    borderColor: `${color}60`,
  } : {};
  
  const handleClick = (e: React.MouseEvent) => {
    if (isClickable) {
      e.stopPropagation();
      onClick();
    }
  };
  
  return (
    <div
      style={{ ...baseStyle, ...dynamicStyle }}
      onClick={handleClick}
      onMouseEnter={() => isClickable && setHover(true)}
      onMouseLeave={() => isClickable && setHover(false)}
      title={`${license.name || license.spdxId || 'License'}${isClickable ? ' - Click to view' : ''}`}
    >
      <Icon size={config.iconSize} />
      <span>{displayName}</span>
    </div>
  );
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Shield, FileText } from 'lucide-react';
import { getLicenseColor, getLicenseDisplayName } from '../../utils/licenseUtils';
export const LicenseBadge = ({ license, size = 'medium', onClick, interactive = false, iconType = 'shield', showFullName = false, }) => {
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
    const baseStyle = {
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
    const dynamicStyle = hover && isClickable ? {
        backgroundColor: `${color}25`,
        borderColor: `${color}60`,
    } : {};
    const handleClick = (e) => {
        if (isClickable) {
            e.stopPropagation();
            onClick();
        }
    };
    return (_jsxs("div", { style: { ...baseStyle, ...dynamicStyle }, onClick: handleClick, onMouseEnter: () => isClickable && setHover(true), onMouseLeave: () => isClickable && setHover(false), title: `${license.name || license.spdxId || 'License'}${isClickable ? ' - Click to view' : ''}`, children: [_jsx(Icon, { size: config.iconSize }), _jsx("span", { children: displayName })] }));
};

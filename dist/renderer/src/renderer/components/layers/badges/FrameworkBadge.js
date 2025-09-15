import { jsx as _jsx } from "react/jsx-runtime";
export const FrameworkBadge = ({ name, color, variant = 'outline', size = 'small', }) => {
    const isSmall = size === 'small';
    if (variant === 'solid') {
        return (_jsx("span", { style: {
                padding: isSmall ? '2px 6px' : '3px 8px',
                backgroundColor: color,
                color: 'white',
                borderRadius: '3px',
                fontSize: isSmall ? '10px' : '11px',
                fontWeight: '500',
            }, children: name }));
    }
    // Outline variant
    return (_jsx("span", { style: {
            padding: isSmall ? '2px 6px' : '3px 8px',
            backgroundColor: `${color}20`,
            color,
            borderRadius: '3px',
            border: `1px solid ${color}40`,
            fontSize: isSmall ? '10px' : '11px',
            fontWeight: '500',
        }, children: name }));
};

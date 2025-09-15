import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const PythonVersionBadge = ({ version, size = 'small', }) => {
    if (!version)
        return null;
    const isSmall = size === 'small';
    const color = '#3776AB'; // Python blue
    return (_jsxs("span", { style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: isSmall ? '1px 6px' : '2px 8px',
            backgroundColor: `${color}15`,
            color,
            borderRadius: '3px',
            fontSize: isSmall ? '10px' : '11px',
            fontWeight: '400',
        }, children: [_jsx("span", { style: { fontSize: isSmall ? '10px' : '12px' }, children: "\uD83D\uDC0D" }), "Python ", version] }));
};

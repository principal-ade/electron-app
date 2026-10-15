import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function PdfView({ src, className }) {
    return (_jsxs("div", { className: className, style: { padding: 24, color: '#888', fontFamily: 'system-ui' }, children: ["PDF preview is not available in this environment yet.", _jsx("br", {}), _jsx("code", { children: src })] }));
}
export default PdfView;

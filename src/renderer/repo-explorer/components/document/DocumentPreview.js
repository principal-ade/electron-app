"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
// react-pdf / pdf.js are heavy and need bundler-specific worker glue. Load them
// only when a PDF is actually viewed, so the DOCX and PPTX paths never pay that
// cost (and a DOCX-only host doesn't need the pdf.js worker wired up).
const PdfView = lazy(() => import("./PdfView"));
function inferKind(src) {
    const lower = (src.split("?")[0] ?? src).toLowerCase();
    if (lower.endsWith(".pdf"))
        return "pdf";
    if (lower.endsWith(".docx"))
        return "docx";
    if (lower.endsWith(".pptx"))
        return "pptx";
    return null;
}
export function DocumentPreview({ src, kind, renderer = "docx-preview", className, }) {
    const containerRef = useRef(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const resolvedKind = kind ?? inferKind(src);
    useEffect(() => {
        if (resolvedKind !== "docx" && resolvedKind !== "pptx")
            return;
        let cancelled = false;
        const container = containerRef.current;
        if (!container)
            return;
        setLoading(true);
        setError(null);
        container.innerHTML = "";
        (async () => {
            try {
                const res = await fetch(src);
                if (!res.ok)
                    throw new Error(`fetch ${res.status}`);
                const buffer = await res.arrayBuffer();
                if (cancelled)
                    return;
                if (resolvedKind === "pptx") {
                    const { init } = await import("@repo-explorer/shims/unsupported-docx");
                    const previewer = init(container, {
                        width: container.clientWidth || 960,
                        height: Math.round((container.clientWidth || 960) * 0.5625),
                        mode: "list",
                    });
                    await previewer.preview(buffer);
                }
                else if (renderer === "mammoth") {
                    const mammoth = await import("@repo-explorer/shims/unsupported-docx");
                    const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer });
                    if (cancelled)
                        return;
                    container.innerHTML = value;
                }
                else {
                    const { renderAsync } = await import("@repo-explorer/shims/unsupported-docx");
                    await renderAsync(buffer, container, undefined, {
                        className: "docx",
                        inWrapper: true,
                        ignoreWidth: false,
                        ignoreHeight: false,
                        breakPages: true,
                        experimental: true,
                    });
                }
                if (!cancelled)
                    setLoading(false);
            }
            catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [src, resolvedKind, renderer]);
    if (resolvedKind === "pdf") {
        return (_jsx(Suspense, { fallback: _jsx("div", { style: { padding: 24, color: "#888", fontFamily: "system-ui" }, children: "Loading PDF\u2026" }), children: _jsx(PdfView, { src: src, className: className }) }));
    }
    if (resolvedKind !== "docx" && resolvedKind !== "pptx") {
        return _jsxs("div", { className: className, children: ["Unsupported document type for: ", src] });
    }
    return (_jsxs("div", { className: className, style: { position: "relative", overflow: "auto" }, children: [loading && (_jsx("div", { style: { padding: 24, color: "#888", fontFamily: "system-ui" }, children: "Rendering document\u2026" })), error && (_jsxs("div", { style: { padding: 24, color: "#c00", fontFamily: "system-ui" }, children: ["Failed to render: ", error] })), _jsx("div", { ref: containerRef })] }));
}

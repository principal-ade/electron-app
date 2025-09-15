import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { Upload, X, Check, RotateCw, ZoomIn, ZoomOut, Move } from 'lucide-react';
export const ImageCropper = ({ isOpen, onClose, onSave, title = "Upload & Crop Image", aspectRatio = 1, shape = 'circle', }) => {
    const { theme } = useTheme();
    const [imageFile, setImageFile] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const containerRef = useRef(null);
    const fileInputRef = useRef(null);
    const CROP_SIZE = 256; // Size of the crop area in pixels
    useEffect(() => {
        if (imageFile) {
            const url = URL.createObjectURL(imageFile);
            setImageUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [imageFile]);
    useEffect(() => {
        if (imageUrl && imageRef.current && canvasRef.current) {
            drawCanvas();
        }
    }, [imageUrl, scale, position]);
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image || !image.complete)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Clear canvas
        ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
        // Calculate scaled dimensions
        const scaledWidth = image.naturalWidth * scale;
        const scaledHeight = image.naturalHeight * scale;
        // Center the image initially
        const offsetX = (CROP_SIZE - scaledWidth) / 2 + position.x;
        const offsetY = (CROP_SIZE - scaledHeight) / 2 + position.y;
        // Draw image with clipping
        ctx.save();
        ctx.beginPath();
        if (shape === 'circle') {
            ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
        }
        else {
            // Rounded square clipping
            const borderRadius = 16;
            ctx.roundRect(0, 0, CROP_SIZE, CROP_SIZE, borderRadius);
        }
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
        ctx.restore();
        // Draw border
        ctx.strokeStyle = theme.colors.border;
        ctx.lineWidth = 2;
        if (shape === 'circle') {
            ctx.beginPath();
            ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2 - 1, 0, Math.PI * 2);
            ctx.stroke();
        }
        else {
            // Rounded square border
            const borderRadius = 16;
            ctx.beginPath();
            ctx.roundRect(1, 1, CROP_SIZE - 2, CROP_SIZE - 2, borderRadius);
            ctx.stroke();
        }
    }, [scale, position, theme.colors.border, shape]);
    const handleFileSelect = (file) => {
        if (file && file.type.startsWith('image/')) {
            setImageFile(file);
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        handleFileSelect(file);
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = () => {
        setIsDragging(false);
    };
    const handleFileInput = (e) => {
        const file = e.target.files?.[0];
        if (file)
            handleFileSelect(file);
    };
    const handleMouseDown = (e) => {
        if (!imageUrl)
            return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };
    const handleMouseMove = (e) => {
        if (!isPanning)
            return;
        setPosition({
            x: e.clientX - panStart.x,
            y: e.clientY - panStart.y,
        });
    };
    const handleMouseUp = () => {
        setIsPanning(false);
    };
    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        // Create a smaller canvas for the final image (128x128)
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 128;
        finalCanvas.height = 128;
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx)
            return;
        // Draw the cropped image to the smaller canvas
        finalCtx.drawImage(canvas, 0, 0, CROP_SIZE, CROP_SIZE, 0, 0, 128, 128);
        // Convert to blob
        finalCanvas.toBlob((blob) => {
            if (blob) {
                onSave(blob);
                handleClose();
            }
        }, 'image/png');
    };
    const handleClose = () => {
        setImageFile(null);
        setImageUrl(null);
        setScale(1);
        setPosition({ x: 0, y: 0 });
        onClose();
    };
    const handleReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)',
        }, onClick: handleClose, children: _jsxs("div", { style: {
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '20px',
                    }, children: [_jsx("h3", { style: {
                                fontSize: '18px',
                                fontWeight: 600,
                                color: theme.colors.text,
                                margin: 0,
                            }, children: title }), _jsx("button", { onClick: handleClose, style: {
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                color: theme.colors.textSecondary,
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }, children: _jsx(X, { size: 20 }) })] }), !imageUrl ? (
                // Upload area
                _jsxs("div", { style: {
                        border: `2px dashed ${isDragging ? theme.colors.primary : theme.colors.border}`,
                        borderRadius: '12px',
                        padding: '40px',
                        textAlign: 'center',
                        backgroundColor: isDragging ? `${theme.colors.primary}10` : theme.colors.backgroundTertiary,
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                    }, onDrop: handleDrop, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onClick: () => fileInputRef.current?.click(), children: [_jsx(Upload, { size: 48, color: theme.colors.textSecondary, style: { marginBottom: '16px' } }), _jsx("p", { style: {
                                fontSize: '16px',
                                color: theme.colors.text,
                                marginBottom: '8px',
                            }, children: "Drop an image here or click to browse" }), _jsx("p", { style: {
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                            }, children: "Supports JPG, PNG, GIF, WebP" }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleFileInput, style: { display: 'none' } })] })) : (
                // Crop area
                _jsxs(_Fragment, { children: [_jsxs("div", { ref: containerRef, style: {
                                position: 'relative',
                                width: `${CROP_SIZE}px`,
                                height: `${CROP_SIZE}px`,
                                margin: '0 auto 20px',
                                cursor: isPanning ? 'grabbing' : 'grab',
                                userSelect: 'none',
                            }, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp, children: [_jsx("canvas", { ref: canvasRef, width: CROP_SIZE, height: CROP_SIZE, style: {
                                        borderRadius: shape === 'circle' ? '50%' : '16px',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                                    } }), _jsx("img", { ref: imageRef, src: imageUrl, onLoad: () => drawCanvas(), style: { display: 'none' }, alt: "Source" })] }), _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '20px',
                            }, children: [_jsx("button", { onClick: () => setScale(Math.max(0.3, scale - 0.1)), style: {
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '6px',
                                        padding: '8px',
                                        cursor: 'pointer',
                                        color: theme.colors.text,
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.background;
                                        e.currentTarget.style.borderColor = theme.colors.primary;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                        e.currentTarget.style.borderColor = theme.colors.border;
                                    }, children: _jsx(ZoomOut, { size: 16 }) }), _jsx("input", { type: "range", min: "0.3", max: "3", step: "0.1", value: scale, onChange: (e) => setScale(parseFloat(e.target.value)), style: {
                                        flex: 1,
                                        height: '4px',
                                        borderRadius: '2px',
                                        outline: 'none',
                                        cursor: 'pointer',
                                    } }), _jsx("button", { onClick: () => setScale(Math.min(3, scale + 0.1)), style: {
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '6px',
                                        padding: '8px',
                                        cursor: 'pointer',
                                        color: theme.colors.text,
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.background;
                                        e.currentTarget.style.borderColor = theme.colors.primary;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                        e.currentTarget.style.borderColor = theme.colors.border;
                                    }, children: _jsx(ZoomIn, { size: 16 }) }), _jsx("button", { onClick: handleReset, style: {
                                        backgroundColor: theme.colors.backgroundTertiary,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: '6px',
                                        padding: '8px',
                                        cursor: 'pointer',
                                        color: theme.colors.text,
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.background;
                                        e.currentTarget.style.borderColor = theme.colors.primary;
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                        e.currentTarget.style.borderColor = theme.colors.border;
                                    }, title: "Reset position and zoom", children: _jsx(RotateCw, { size: 16 }) })] }), _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                borderRadius: '8px',
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                                marginBottom: '20px',
                            }, children: [_jsx(Move, { size: 14 }), _jsx("span", { children: "Drag image to reposition \u2022 Use slider to zoom" })] })] })), imageUrl && (_jsxs("div", { style: {
                        display: 'flex',
                        gap: '12px',
                        marginTop: 'auto',
                    }, children: [_jsx("button", { onClick: () => {
                                setImageFile(null);
                                setImageUrl(null);
                                setScale(1);
                                setPosition({ x: 0, y: 0 });
                            }, style: {
                                flex: 1,
                                padding: '10px',
                                borderRadius: '8px',
                                backgroundColor: theme.colors.backgroundTertiary,
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.background;
                                e.currentTarget.style.borderColor = theme.colors.primary;
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                                e.currentTarget.style.borderColor = theme.colors.border;
                            }, children: "Choose Different" }), _jsxs("button", { onClick: handleSave, style: {
                                flex: 1,
                                padding: '10px',
                                borderRadius: '8px',
                                backgroundColor: theme.colors.primary,
                                color: theme.colors.background,
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.opacity = '0.9';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.opacity = '1';
                            }, children: [_jsx(Check, { size: 16 }), "Save Avatar"] })] }))] }) }));
};

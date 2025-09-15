import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FiLoader } from './Icons';
export const LoadingOverlay = ({ isLoading, message = 'Loading...', fullScreen = false, blur = true, opacity = 0.8, spinnerSize = 48, backgroundColor = 'rgba(255, 255, 255, 0.9)', children, }) => {
    if (!isLoading && !children) {
        return null;
    }
    const overlayStyle = {
        position: fullScreen ? 'fixed' : 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isLoading ? backgroundColor : 'transparent',
        backdropFilter: isLoading && blur ? 'blur(4px)' : 'none',
        WebkitBackdropFilter: isLoading && blur ? 'blur(4px)' : 'none',
        opacity: isLoading ? opacity : 0,
        pointerEvents: isLoading ? 'all' : 'none',
        transition: 'opacity 0.3s ease',
        zIndex: fullScreen ? 9999 : 1000,
    };
    const contentStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isLoading ? 1 : 0,
        transform: isLoading ? 'scale(1)' : 'scale(0.9)',
        transition: 'all 0.3s ease',
    };
    return (_jsxs("div", { className: "loading-overlay-wrapper", style: { position: 'relative', width: '100%', height: '100%' }, children: [children, _jsx("div", { className: "loading-overlay", style: overlayStyle, children: _jsxs("div", { style: contentStyle, children: [_jsx(FiLoader, { size: spinnerSize, className: "loading-spinner", style: {
                                animation: 'spin 1s linear infinite',
                                color: '#007bff',
                                marginBottom: message ? '1rem' : 0,
                            } }), message && (_jsx("div", { style: {
                                fontSize: '1.1rem',
                                fontWeight: 500,
                                color: '#333',
                                textAlign: 'center',
                                maxWidth: '300px',
                            }, children: message }))] }) })] }));
};
export const LoadingSpinner = ({ size = 20, color = '#007bff', className = '', }) => {
    return (_jsx(FiLoader, { size: size, className: `loading-spinner ${className}`, style: {
            animation: 'spin 1s linear infinite',
            color,
        } }));
};
export const LoadingDots = ({ color = '#007bff', size = 8, }) => {
    const dotStyle = {
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        margin: '0 4px',
        animation: 'pulse 1.4s infinite ease-in-out both',
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }, children: [_jsx("div", { style: { ...dotStyle, animationDelay: '-0.32s' } }), _jsx("div", { style: { ...dotStyle, animationDelay: '-0.16s' } }), _jsx("div", { style: dotStyle })] }));
};
export const SkeletonLoader = ({ width = '100%', height = 20, borderRadius = 4, className = '', animate = true, }) => {
    return (_jsx("div", { className: `skeleton-loader ${className}`, style: {
            width,
            height,
            borderRadius,
            backgroundColor: '#e9ecef',
            backgroundImage: animate
                ? 'linear-gradient(90deg, #e9ecef 25%, #f8f9fa 50%, #e9ecef 75%)'
                : 'none',
            backgroundSize: '200% 100%',
            animation: animate ? 'shimmer 1.5s infinite' : 'none',
        } }));
};
export const ProgressBar = ({ progress, height = 8, color = '#007bff', backgroundColor = '#e9ecef', showPercentage = false, animated = true, }) => {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    return (_jsxs("div", { style: { width: '100%' }, children: [_jsx("div", { style: {
                    width: '100%',
                    height,
                    backgroundColor,
                    borderRadius: height / 2,
                    overflow: 'hidden',
                    position: 'relative',
                }, children: _jsx("div", { style: {
                        width: `${clampedProgress}%`,
                        height: '100%',
                        backgroundColor: color,
                        transition: animated ? 'width 0.3s ease' : 'none',
                        position: 'relative',
                        overflow: 'hidden',
                    }, children: animated && clampedProgress > 0 && clampedProgress < 100 && (_jsx("div", { style: {
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            right: 0,
                            backgroundImage: `linear-gradient(
                  45deg,
                  rgba(255, 255, 255, 0.15) 25%,
                  transparent 25%,
                  transparent 50%,
                  rgba(255, 255, 255, 0.15) 50%,
                  rgba(255, 255, 255, 0.15) 75%,
                  transparent 75%,
                  transparent
                )`,
                            backgroundSize: '1rem 1rem',
                            animation: 'progress-bar-stripes 1s linear infinite',
                        } })) }) }), showPercentage && (_jsxs("div", { style: {
                    textAlign: 'center',
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#6c757d',
                }, children: [clampedProgress, "%"] }))] }));
};
export default LoadingOverlay;

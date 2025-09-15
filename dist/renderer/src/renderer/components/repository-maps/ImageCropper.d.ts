import React from 'react';
interface ImageCropperProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (croppedImageBlob: Blob) => void;
    title?: string;
    aspectRatio?: number;
    shape?: 'circle' | 'square';
}
export declare const ImageCropper: React.FC<ImageCropperProps>;
export {};
//# sourceMappingURL=ImageCropper.d.ts.map
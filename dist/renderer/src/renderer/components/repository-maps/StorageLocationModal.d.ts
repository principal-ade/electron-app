import React from 'react';
import { StorageLocation } from '../../types/planning-storage.types';
interface StorageLocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectLocation: (location: StorageLocation) => void;
    title?: string;
}
export declare const StorageLocationModal: React.FC<StorageLocationModalProps>;
export {};
//# sourceMappingURL=StorageLocationModal.d.ts.map
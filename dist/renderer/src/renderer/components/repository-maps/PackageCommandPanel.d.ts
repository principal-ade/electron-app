import React from 'react';
import { PackageLayer, PackageCommand } from "@principal-ai/codebase-composition";
import { TouchedProject } from '../../utils/sessionProjectMapping';
interface PackageCommandPanelProps {
    isOpen: boolean;
    onClose: () => void;
    package: PackageLayer | null;
    touchedProject?: TouchedProject;
    sessionCount: number;
    onRunCommand: (command: PackageCommand) => Promise<void>;
    repositoryPath?: string;
}
export declare const PackageCommandPanel: React.FC<PackageCommandPanelProps>;
export {};
//# sourceMappingURL=PackageCommandPanel.d.ts.map
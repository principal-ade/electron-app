import React from 'react';
import { ValidationCommand, CommandResult } from '../../../shared/validation-types';
interface CommandCardProps {
    command: ValidationCommand;
    isRunning?: boolean;
    lastResult?: CommandResult;
    onEdit: (commandId: string) => void;
    onTest: (commandId: string) => void;
    onDelete: (commandId: string) => void;
}
declare const CommandCard: React.FC<CommandCardProps>;
export default CommandCard;
//# sourceMappingURL=CommandCard.d.ts.map
import React from 'react';
import { BaseTitlebar } from './BaseTitlebar';

export interface SearchWindowTitlebarProps {
  // No additional props needed for now
}

export const SearchWindowTitlebar: React.FC<SearchWindowTitlebarProps> = () => {
  return (
    <BaseTitlebar title="Alexandria Search" />
  );
};
import React from 'react';
import { useTheme } from 'themed-markdown';
import { SearchWindowTitlebar } from '../components/Titlebar';
import { AllRepositoryMarkdownSearchView } from './AllRepositoryMarkdownSearch/AllRepositoryMarkdownSearchView';

/**
 * SearchWindow - A dedicated window for Alexandria repository search
 * This component wraps the AllRepositoryMarkdownSearchView in a standalone window context
 */
export const SearchWindow: React.FC = () => {
  const { theme } = useTheme();

  const handleClose = () => {
    // Close the window when the search view is closed
    window.close();
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      <SearchWindowTitlebar />
      <div
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <AllRepositoryMarkdownSearchView onClose={handleClose} />
      </div>
    </div>
  );
};
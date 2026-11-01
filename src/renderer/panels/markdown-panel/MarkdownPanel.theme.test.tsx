/// <reference types="jest" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ThemeProvider,
  slateNeonTheme,
  slatePeachTheme,
  type Theme,
} from '@principal-ade/industry-theme';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { MarkdownPanel } from './MarkdownPanel';

jest.mock('themed-markdown', () => ({
  DocumentView: ({ theme }: { theme: Theme }) => (
    <div
      data-testid="document"
      data-primary={theme.colors.primary}
      data-accent={theme.colors.accent}
    />
  ),
  SlidePresentation: ({ theme }: { theme: Theme }) => (
    <div
      data-testid="slides"
      data-primary={theme.colors.primary}
      data-accent={theme.colors.accent}
    />
  ),
}));
jest.mock('../../main-process-api/DocumentNotesService', () => ({
  DocumentNotesService: { list: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../hooks/useFileWatch', () => ({ useFileWatch: jest.fn() }));
jest.mock('../../hooks/useMarkdownLinkHandler', () => ({
  useMarkdownLinkHandler: () => ({}),
}));
jest.mock('../../dev-workspace/file-city-panel/MarkdownNotes', () => ({
  MarkdownSelectionPill: () => null,
}));

test('uses Slate Peach for both document and slideshow rendering', async () => {
  const events = {
    emit: jest.fn(),
    on: jest.fn().mockReturnValue(jest.fn()),
  } as unknown as PanelEventEmitter;
  render(
    <ThemeProvider theme={slateNeonTheme}>
      <MarkdownPanel
        context={{
          currentScope: { type: 'repository' },
          refresh: async () => {},
        }}
        actions={{
          readFile: jest
            .fn()
            .mockResolvedValue('# First slide\n\n---\n\n# Second slide'),
        }}
        events={events}
        filePath="/repo/notes.md"
        repositoryPath="/repo"
      />
    </ThemeProvider>,
  );
  const document = await screen.findByTestId('document');
  expect(document.getAttribute('data-primary')).toBe(
    slatePeachTheme.colors.primary,
  );
  expect(document.getAttribute('data-accent')).toBe(
    slatePeachTheme.colors.accent,
  );

  fireEvent.click(screen.getByTitle('Present as slideshow'));
  const slides = await screen.findByTestId('slides');
  expect(slides.getAttribute('data-primary')).toBe(
    slatePeachTheme.colors.primary,
  );
  expect(slides.getAttribute('data-accent')).toBe(
    slatePeachTheme.colors.accent,
  );
});

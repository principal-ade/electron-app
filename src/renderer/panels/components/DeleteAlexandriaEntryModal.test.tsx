import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { DeleteAlexandriaEntryModal } from './DeleteAlexandriaEntryModal';
import { ShellService } from '../../main-process-api/ShellService';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {},
      fonts: {},
      fontSizes: [],
      fontWeights: {},
    },
  }),
}));
jest.mock('../../main-process-api/ShellService', () => ({
  ShellService: { openPath: jest.fn() },
}));
jest.mock('../../main-process-api/GitService', () => ({
  GitService: {
    getBranchStatus: jest.fn().mockResolvedValue({ branch: 'main', ahead: 0 }),
    execCommand: jest.fn().mockResolvedValue({ stdout: '' }),
  },
}));

it('warns about closing terminals and shows the selected clone path', async () => {
  render(
    <DeleteAlexandriaEntryModal
      isOpen
      entry={{ name: 'repo', path: '/other-clone' } as AlexandriaEntry}
      clonePath="/selected-clone"
      onClose={jest.fn()}
      onConfirm={jest.fn()}
    />,
  );
  await screen.findByText(
    /Any open terminals for this clone will be closed first, stopping their running commands/,
  );
  expect(screen.getByText('/selected-clone')).toBeTruthy();
  fireEvent.click(screen.getByText('Open in Finder'));
  expect(ShellService.openPath).toHaveBeenCalledWith('/selected-clone');
});

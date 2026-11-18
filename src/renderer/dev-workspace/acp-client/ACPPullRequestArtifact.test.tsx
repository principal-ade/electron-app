import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ShellService } from '../../main-process-api/ShellService';
import { ACPPullRequestArtifact } from './ACPPullRequestArtifact';

jest.mock('../../main-process-api/ShellService', () => ({
  ShellService: {
    openExternal: jest.fn().mockResolvedValue({ success: true }),
  },
}));

const mockedShellService = ShellService as jest.Mocked<typeof ShellService>;

function renderArtifact(ui: React.ReactElement) {
  return render(<ul>{ui}</ul>);
}

describe('ACPPullRequestArtifact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('links a pasted pull request target', () => {
    const onLink = jest.fn();
    renderArtifact(
      <ACPPullRequestArtifact onLink={onLink} onUnlink={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Link pull request' }));
    fireEvent.change(
      screen.getByLabelText('GitHub pull request URL or owner/repo#123'),
      { target: { value: 'acme/widgets#42' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));

    expect(onLink).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      number: 42,
      url: 'https://github.com/acme/widgets/pull/42',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reports an invalid target inline', () => {
    const onLink = jest.fn();
    renderArtifact(
      <ACPPullRequestArtifact onLink={onLink} onUnlink={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Link pull request' }));
    fireEvent.change(
      screen.getByLabelText('GitHub pull request URL or owner/repo#123'),
      { target: { value: 'not a pull request' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));

    expect(onLink).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Paste a GitHub pull request URL',
    );
  });

  it('opens the linked pull request and can unlink it', () => {
    const onUnlink = jest.fn();
    renderArtifact(
      <ACPPullRequestArtifact
        pullRequest={{
          owner: 'acme',
          repo: 'widgets',
          number: 42,
          url: 'https://github.com/acme/widgets/pull/42',
        }}
        onLink={jest.fn()}
        onUnlink={onUnlink}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open acme/widgets#42 on GitHub' }),
    );
    expect(mockedShellService.openExternal).toHaveBeenCalledWith(
      'https://github.com/acme/widgets/pull/42',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Unlink acme/widgets#42' }),
    );
    expect(onUnlink).toHaveBeenCalled();
  });
});

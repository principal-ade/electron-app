import React, { useCallback, useRef, useState } from 'react';
import { Link2, X } from 'lucide-react';
import type { AcpLinkedPullRequest } from '../../events/portalTabs';
import { ShellService } from '../../main-process-api/ShellService';
import {
  parsePullRequestTarget,
  pullRequestLabel,
} from '../../utils/pullRequestLink';

export interface ACPPullRequestArtifactProps {
  pullRequest?: AcpLinkedPullRequest;
  /** Avatar for the PR owner when the host already has it. */
  ownerAvatarUrl?: string;
  onLink: (pullRequest: AcpLinkedPullRequest) => void;
  onUnlink: () => void;
}

/**
 * A pull request rendered in the ACP Artifacts panel. Unlike the other
 * artifacts it has no in-app preview: clicking the card opens the PR on GitHub.
 * Without a link the same row becomes the add affordance, so the panel has one
 * consistent list whether or not a PR is attached.
 */
export function ACPPullRequestArtifact({
  pullRequest,
  ownerAvatarUrl,
  onLink,
  onUnlink,
}: ACPPullRequestArtifactProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = React.useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  const openForm = useCallback(() => {
    setIsOpen(true);
    setError(null);
    // The input mounts in the same commit; focus it on the next frame.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = parsePullRequestTarget(draft);
      if (!parsed) {
        setError('Paste a GitHub pull request URL or owner/repo#123.');
        return;
      }
      onLink(parsed);
      setDraft('');
      setError(null);
      setIsOpen(false);
    },
    [draft, onLink],
  );

  if (pullRequest) {
    const label = pullRequestLabel(pullRequest);
    return (
      <li className="acp-session__artifact-card">
        <button
          className="acp-session__artifact-open has-remove"
          type="button"
          aria-label={`Open ${label} on GitHub`}
          title={`Open ${label} on GitHub`}
          onClick={() => void ShellService.openExternal(pullRequest.url)}
        >
          <span
            className="acp-client__owner-avatar acp-session__artifact-avatar"
            aria-hidden="true"
          >
            {pullRequest.owner.slice(0, 2).toUpperCase()}
            <img
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
              src={
                ownerAvatarUrl ??
                `https://github.com/${pullRequest.owner}.png?size=64`
              }
            />
          </span>
          <span>
            <strong>#{pullRequest.number}</strong>
            <small>Pull request</small>
          </span>
        </button>
        <button
          className="acp-session__artifact-remove"
          type="button"
          aria-label={`Unlink ${label}`}
          title="Unlink pull request"
          onClick={onUnlink}
        >
          <X size={13} />
        </button>
      </li>
    );
  }

  if (isOpen) {
    return (
      <li className="acp-session__artifact-card">
        <form
          className="acp-session__artifact-link-form"
          role="dialog"
          aria-label="Link a pull request"
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <label htmlFor={inputId}>
            GitHub PR URL or <code>owner/repo#123</code>
          </label>
          <input
            id={inputId}
            ref={inputRef}
            aria-label="GitHub pull request URL or owner/repo#123"
            value={draft}
            placeholder="https://github.com/owner/repo/pull/123"
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
          />
          {error ? (
            <p className="acp-session__artifact-link-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="acp-session__artifact-link-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="is-primary">
              Link
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="acp-session__artifact-card">
      <button
        className="acp-session__artifact-open acp-session__artifact-open--link"
        type="button"
        aria-label="Link pull request"
        title="Link a pull request to this session"
        onClick={openForm}
      >
        <Link2 size={16} strokeWidth={1.5} aria-hidden="true" />
        <span>
          <strong>Link pull request</strong>
          <small>Attach a GitHub PR to this session</small>
        </span>
      </button>
    </li>
  );
}

export default ACPPullRequestArtifact;

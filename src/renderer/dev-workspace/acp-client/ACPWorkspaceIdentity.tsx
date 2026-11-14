import React from 'react';
import { FolderOpen } from 'lucide-react';

export interface ACPWorkspaceIdentityProps {
  workspacePath: string;
  repository?: {
    owner: string;
    name: string;
    avatarUrl?: string;
  };
}

export function ACPWorkspaceIdentity({
  workspacePath,
  repository,
}: ACPWorkspaceIdentityProps) {
  if (!repository) {
    return (
      <div className="acp-session__identity">
        <span className="acp-client__brand-icon" aria-hidden="true">
          <FolderOpen size={16} />
        </span>
        <span className="acp-session__identity-copy">
          <strong>{workspacePath}</strong>
        </span>
      </div>
    );
  }

  return (
    <div className="acp-session__identity">
      <span className="acp-client__owner-avatar" aria-hidden="true">
        {repository.owner.slice(0, 2).toUpperCase()}
        {repository.avatarUrl ? (
          <img
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            src={repository.avatarUrl}
          />
        ) : null}
      </span>
      <span className="acp-session__identity-copy">
        <strong>{repository.name}</strong>
      </span>
    </div>
  );
}

export default ACPWorkspaceIdentity;

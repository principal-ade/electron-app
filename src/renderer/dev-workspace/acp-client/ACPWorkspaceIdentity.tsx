import React from 'react';
import { OpenCodeIcon } from '../../components/OpenCodeIcon';

export interface ACPWorkspaceIdentityProps {
  sessionTitle?: string | null;
}

export function ACPWorkspaceIdentity({
  sessionTitle,
}: ACPWorkspaceIdentityProps) {
  const primary = sessionTitle?.trim() || 'New session';
  return (
    <div className="acp-session__identity">
      <span
        className="acp-session__identity-logo"
        aria-hidden="true"
      >
        <OpenCodeIcon size={20} />
      </span>
      <span className="acp-session__identity-copy">
        <strong>{primary}</strong>
      </span>
    </div>
  );
}

export default ACPWorkspaceIdentity;

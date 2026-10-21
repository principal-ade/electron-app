import React, { useEffect, useState } from 'react';
import {
  parseRequestTarget,
  REQUEST_TARGET_IDENTIFIER_MAX_LENGTH,
  REQUEST_TARGET_PURL_MAX_LENGTH,
  type RequestTarget,
} from '../../shared/requests/preparedRequest';

export const RequestTargetEditor: React.FC<{
  target?: RequestTarget;
  onChange: (target: RequestTarget | undefined) => void;
}> = ({ target, onChange }) => {
  const [purl, setPurl] = useState(target?.purl ?? '');
  const [identifier, setIdentifier] = useState(target?.identifier ?? '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPurl(target?.purl ?? '');
    setIdentifier(target?.identifier ?? '');
    setError(null);
  }, [target?.purl, target?.identifier]);

  return (
    <details style={{ padding: '8px 12px', fontSize: 12 }}>
      <summary style={{ cursor: 'pointer', overflowWrap: 'anywhere' }}>
        Request group:{' '}
        {target ? `${target.purl} / ${target.identifier}` : 'Ungrouped'}
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onChange(parseRequestTarget({ purl, identifier }));
            setError(null);
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : 'Invalid request group.',
            );
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingTop: 8,
        }}
      >
        <span>Unverified grouping only. Does not change the request URL.</span>
        <label>
          Target PURL
          <input
            aria-label="Target PURL"
            value={purl}
            maxLength={REQUEST_TARGET_PURL_MAX_LENGTH}
            onChange={(event) => setPurl(event.target.value)}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
          />
        </label>
        <label>
          Target identifier
          <input
            aria-label="Target identifier"
            placeholder="Container or component name / ID"
            value={identifier}
            maxLength={REQUEST_TARGET_IDENTIFIER_MAX_LENGTH}
            onChange={(event) => setIdentifier(event.target.value)}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit">Apply group</button>
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setPurl('');
              setIdentifier('');
              setError(null);
            }}
          >
            Clear group
          </button>
        </div>
        {error && <div role="alert">{error}</div>}
      </form>
    </details>
  );
};

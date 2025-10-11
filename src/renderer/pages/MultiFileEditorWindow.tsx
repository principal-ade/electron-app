import React, { useEffect } from 'react';

/**
 * The legacy multi-file editor window has been retired while we migrate away from
 * the bespoke Monaco integration. Calling this window now simply warns the user
 * that the surface is unavailable.
 */
export const MultiFileEditorWindow: React.FC<Record<string, unknown>> = () => {
  useEffect(() => {
    window.alert(
      'The multi-file editor is temporarily unavailable while we migrate to the new Monaco experience.',
    );
  }, []);

  return (
    <div
      style={{
        alignItems: 'center',
        color: 'var(--foreground, #111827)',
        display: 'flex',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        height: '100vh',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        width: '100vw',
        backgroundColor: 'var(--background, #f9fafb)',
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          Multi-file editor unavailable
        </h1>
        <p style={{ lineHeight: 1.5 }}>
          We&apos;re migrating our editing surfaces to the industry-themed
          Monaco editor. The multi-file editor window has been disabled during
          this transition.
        </p>
      </div>
    </div>
  );
};

import React, { useCallback, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { BookOpen, Check, Compass, Copy } from 'lucide-react';

type PromptIdeaPurpose = 'informative' | 'investigation';

const TRAIL_PROMPT_IDEAS: Array<{
  label: string;
  prompt: string;
  purpose: PromptIdeaPurpose;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}> = [
  {
    label: 'Investigation',
    Icon: Compass,
    purpose: 'investigation',
    prompt:
      'Use the author-investigation-trail skill in this codebase to investigate <question or symptom>.',
  },
  {
    label: 'Informative',
    Icon: BookOpen,
    purpose: 'informative',
    prompt:
      'Use the author-informative-trail skill in this codebase to lay a canonical trail through <feature or system>.',
  },
];

// Matches the city's per-purpose palette (green = informative, purple =
// investigation) so the prompt cards read as the same identity as the
// city's highlight layer.
const promptAccent = (purpose: PromptIdeaPurpose, success?: string): string =>
  purpose === 'informative' ? (success ?? '#10b981') : '#a855f7';

/**
 * Shared "Create a Trail" empty-state: a hero headline, a hover hint, and
 * the two trail-creation prompt cards (Investigation / Informative). Each
 * card copies a skill-invocation prompt to the clipboard so the user can
 * paste it into an agent — there's no window/skill launch. Rendered on the
 * HomeView welcome screen and in the TrailsView landing when the trail
 * library is empty.
 *
 * Returns a fragment of three `flex: 0 0 auto` blocks, so the host must be
 * a centered flex column. `headingMarginTop` tunes the hero's top offset to
 * fit each host's surrounding chrome (HomeView sits below a header;
 * TrailsView's empty overlay has its own padding).
 */
export const TrailPromptIdeas: React.FC<{
  headingMarginTop?: React.CSSProperties['marginTop'];
}> = ({ headingMarginTop = '22vh' }) => {
  const { theme } = useTheme();

  // Which trail-prompt-idea card was most recently copied (resets after a
  // short delay so the check icon goes back to the copy icon).
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(
    null,
  );
  const [anyCardHovered, setAnyCardHovered] = useState(false);

  const handleCopyPrompt = useCallback(
    async (prompt: string, index: number) => {
      try {
        await navigator.clipboard.writeText(prompt);
        setCopiedPromptIndex(index);
        window.setTimeout(
          () =>
            setCopiedPromptIndex((current) =>
              current === index ? null : current,
            ),
          1500,
        );
      } catch (error) {
        console.error('[TrailPromptIdeas] Failed to copy prompt:', error);
      }
    },
    [],
  );

  return (
    <>
      <div
        style={{
          flex: '0 0 auto',
          marginTop: headingMarginTop,
          textAlign: 'center',
          maxWidth: 640,
        }}
      >
        <div
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.heading ?? theme.fonts.body,
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: theme.fontWeights.bold,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            marginBottom: 12,
          }}
        >
          Create a <span style={{ color: theme.colors.primary }}>Trail</span>
        </div>
      </div>

      <div
        style={{
          flex: '0 0 auto',
          marginTop: 64,
          color: theme.colors.primary,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[2],
          textAlign: 'center',
          opacity: anyCardHovered ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
      >
        Copy Prompt for Agent
      </div>

      <div
        style={{
          flex: '0 0 auto',
          marginTop: 16,
          width: '100%',
          maxWidth: 960,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <style>{`
          .trail-idea-card {
            border-color: transparent !important;
            transition: border-color 150ms ease;
          }
          .trail-idea-card:hover {
            border-color: ${theme.colors.primary} !important;
          }
          .trail-idea-copy {
            opacity: 0;
            transition: opacity 150ms ease;
          }
          .trail-idea-card:hover .trail-idea-copy,
          .trail-idea-copy.is-copied {
            opacity: 1;
          }
        `}</style>

        {TRAIL_PROMPT_IDEAS.map((idea, i) => {
          const isCopied = copiedPromptIndex === i;
          const accent = promptAccent(idea.purpose, theme.colors.success);
          return (
            <div
              key={idea.label}
              className="trail-idea-card"
              role="button"
              tabIndex={0}
              onClick={() => void handleCopyPrompt(idea.prompt, i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleCopyPrompt(idea.prompt, i);
                }
              }}
              onMouseEnter={() => setAnyCardHovered(true)}
              onMouseLeave={() => setAnyCardHovered(false)}
              onFocus={() => setAnyCardHovered(true)}
              onBlur={() => setAnyCardHovered(false)}
              style={{
                position: 'relative',
                flex: '1 1 340px',
                width: '100%',
                maxWidth: 380,
                aspectRatio: '16 / 9',
                padding: '32px 36px',
                borderRadius: 10,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
            >
              <idea.Icon size={48} color={accent} />
              <div
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.semibold,
                  color: accent,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {idea.label}
              </div>
              <div
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[3],
                  color: theme.colors.text,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {idea.prompt}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCopyPrompt(idea.prompt, i);
                }}
                title={isCopied ? 'Copied' : 'Copy prompt'}
                className={
                  isCopied ? 'trail-idea-copy is-copied' : 'trail-idea-copy'
                }
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 6,
                  background: theme.colors.background,
                  color: isCopied
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                  cursor: 'pointer',
                }}
              >
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
};

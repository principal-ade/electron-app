/**
 * SpecTabContent
 *
 * Tab body for an OpenSpec-style spec file (`openspec/specs/<capability>/spec.md`
 * or `openspec/changes/<change>/specs/<capability>/spec.md` — see
 * https://github.com/Fission-AI/OpenSpec). The tab self-loads the file (with
 * live reload via `useFileWatch`) and renders:
 *
 * - an app-themed header: breadcrumb (repo → change → capability), a
 *   capability-vs-change badge, delta chips (ADDED / MODIFIED / …) with counts,
 *   requirement / scenario stats, copy-path + reload actions;
 * - a reading-themed body with a structured Overview (requirement cards,
 *   nested scenario cards, and delta-colored sections), plus a Markdown tab for
 *   the original document; a requirements rail on the left tracks either view.
 *
 * Sibling patterns: `LocalTopicTabContent` (header + reading body split),
 * `TopicDescriptionBody` (DOM-heading outline + active tracking), and
 * `MarkdownDocTabContent` (plain markdown doc tab this specializes).
 */

import React, { useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { DocumentView } from 'themed-markdown';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  FileCode2,
  Layers3,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import {
  PanelEventBus,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { useFileWatch } from '../hooks/useFileWatch';
import { useMarkdownLinkHandler } from '../hooks/useMarkdownLinkHandler';
import { MarkdownLinkNotice } from '../components/MarkdownLinkNotice';
import { parseSpecPath } from './specPaths';
import {
  parseSpecMarkdown,
  parseSpecDocument,
  type DeltaSectionKind,
  type SpecDocument,
  type SpecOutline,
} from './specOutline';
import './SpecTabContent.css';

export interface SpecTabContentProps {
  /** Absolute path of the spec file (`spec.md` under an `openspec/` tree). */
  filePath: string;
  /** Host repo the spec belongs to (for link resolution + the breadcrumb). */
  repositoryPath?: string;
  /**
   * Panel event bus for doc-link clicks (`file:opened` → the host opens a
   * tab). Optional; stories can omit it and links degrade to no-ops except
   * external ones, which still open in the OS browser.
   */
  events?: PanelEventEmitter;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      content: string;
      outline: SpecOutline;
      document: SpecDocument;
    };

/** Delta-chip accent colors, keyed by delta section kind. */
const DELTA_CHIP_COLORS: Record<
  DeltaSectionKind,
  'success' | 'warning' | 'error' | 'info' | 'muted'
> = {
  ADDED: 'success',
  MODIFIED: 'warning',
  REMOVED: 'error',
  RENAMED: 'info',
  DEPRECATED: 'muted',
};

/** Repository display name from an absolute path (last segment). */
const repoName = (path: string): string =>
  path.split('/').filter(Boolean).pop() || path;

// ----------------------------------------------------------------------------
// Reading body: requirements rail + a structured view / source Markdown toggle
// ----------------------------------------------------------------------------

/** One rail row under a section group. */
interface RailItem {
  id: string;
  title: string;
  scenarioCount?: number;
}

/** A rail group: a rendered h2 (Purpose / Requirements / ADDED Requirements…) plus its h3 rows. */
interface RailGroup {
  id: string;
  label: string;
  items: RailItem[];
}

interface SpecBodyProps {
  content: string;
  outline: SpecOutline;
  document: SpecDocument;
  filePath: string;
  repositoryPath?: string;
  events: PanelEventEmitter;
}

type SpecReaderMode = 'overview' | 'markdown';

type SpecPartSelection =
  | { type: 'section'; sectionIndex: number }
  | { type: 'requirement'; sectionIndex: number; requirementIndex: number }
  | {
      type: 'scenario';
      sectionIndex: number;
      requirementIndex: number;
      scenarioIndex: number;
    };

function initialSpecPart(document: SpecDocument): SpecPartSelection {
  // Start with the short Purpose overview when present. Change deltas often
  // have no Purpose section, so focus the first added/modified requirement.
  const purposeIndex = document.sections.findIndex(
    (section) => section.kind === 'purpose',
  );
  if (purposeIndex >= 0) {
    return { type: 'section', sectionIndex: purposeIndex };
  }
  const requirementSectionIndex = document.sections.findIndex(
    (section) => section.requirements.length > 0,
  );
  if (requirementSectionIndex >= 0) {
    return {
      type: 'requirement',
      sectionIndex: requirementSectionIndex,
      requirementIndex: 0,
    };
  }
  return { type: 'section', sectionIndex: 0 };
}

function normalizeSpecPart(
  document: SpecDocument,
  selection: SpecPartSelection,
): SpecPartSelection {
  const section = document.sections[selection.sectionIndex];
  if (!section) return initialSpecPart(document);
  if (selection.type === 'section') return selection;
  const requirement = section.requirements[selection.requirementIndex];
  if (!requirement)
    return { type: 'section', sectionIndex: selection.sectionIndex };
  if (selection.type === 'requirement') return selection;
  if (!requirement.scenarios[selection.scenarioIndex]) {
    return {
      type: 'requirement',
      sectionIndex: selection.sectionIndex,
      requirementIndex: selection.requirementIndex,
    };
  }
  return selection;
}

const sectionAccent = (
  kind: SpecDocument['sections'][number]['kind'],
  theme: ReturnType<typeof useTheme>['theme'],
): string => {
  if (!kind.startsWith('delta-')) return theme.colors.primary;
  const delta = kind.slice('delta-'.length) as DeltaSectionKind;
  const color = DELTA_CHIP_COLORS[delta];
  return color === 'muted' ? theme.colors.textSecondary : theme.colors[color];
};

/** Small Markdown fragment styled to flow naturally inside a spec card. */
const SpecMarkdownFragment: React.FC<{
  content: string;
  prefix: string;
  accent?: string;
  onLinkClick: (href: string, event?: MouseEvent) => void;
}> = ({ content, prefix, accent, onLinkClick }) => {
  const { theme } = useTheme();
  if (!content.trim()) return null;
  return (
    <div
      className="spec-markdown-fragment"
      style={
        {
          '--spec-accent': accent ?? theme.colors.primary,
        } as React.CSSProperties
      }
    >
      <DocumentView
        content={content}
        theme={theme}
        slideIdPrefix={prefix}
        maxWidth="100%"
        onLinkClick={onLinkClick}
      />
    </div>
  );
};

/** Outline tree for selecting one part of a spec at a time. */
const SpecPartNavigation: React.FC<{
  document: SpecDocument;
  selection: SpecPartSelection;
  onSelect: (part: SpecPartSelection) => void;
}> = ({ document, selection, onSelect }) => {
  const { theme } = useTheme();
  const navRef = React.useRef<HTMLElement>(null);

  const isSelected = (part: SpecPartSelection) =>
    part.type === selection.type &&
    part.sectionIndex === selection.sectionIndex &&
    (part.type === 'section' ||
      (selection.type !== 'section' &&
        part.requirementIndex === selection.requirementIndex &&
        (part.type !== 'scenario' ||
          (selection.type === 'scenario' &&
            part.scenarioIndex === selection.scenarioIndex))));

  const buttonStyle = (
    selected: boolean,
    depth: number,
  ): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    minWidth: 0,
    padding: `7px 8px 7px ${8 + depth * 14}px`,
    border: 'none',
    borderRadius: 6,
    background: selected ? theme.colors.backgroundSecondary : 'transparent',
    color: selected ? theme.colors.primary : theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes[1],
    fontWeight: selected ? 600 : 400,
    lineHeight: theme.lineHeights.tight,
    textAlign: 'left',
    cursor: 'pointer',
  });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(
      navRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[data-spec-nav-item]',
      ) ?? [],
    );
    const currentIndex = buttons.indexOf(event.target as HTMLButtonElement);
    if (currentIndex < 0) return;

    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = Math.max(
      0,
      Math.min(buttons.length - 1, currentIndex + direction),
    );
    const nextButton = buttons[nextIndex];
    nextButton?.focus();
    nextButton?.click();
  };

  return (
    <nav
      ref={navRef}
      onKeyDown={handleKeyDown}
      aria-label="Spec outline"
      aria-keyshortcuts="ArrowUp ArrowDown"
      style={{
        width: 260,
        flexShrink: 0,
        borderRight: `1px solid ${theme.colors.border}`,
        overflowY: 'auto',
        padding: '12px 8px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {document.sections.map((section, sectionIndex) => {
        const accent = sectionAccent(section.kind, theme);
        return (
          <div key={`${section.kind}-${section.label}`}>
            <button
              className="spec-outline-item"
              data-spec-nav-item
              type="button"
              aria-current={isSelected({ type: 'section', sectionIndex })}
              onClick={() => onSelect({ type: 'section', sectionIndex })}
              style={
                {
                  ...buttonStyle(
                    isSelected({ type: 'section', sectionIndex }),
                    0,
                  ),
                  '--spec-outline-hover': theme.colors.backgroundHover,
                  color: isSelected({ type: 'section', sectionIndex })
                    ? accent
                    : theme.colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.035em',
                  fontWeight: 700,
                } as React.CSSProperties
              }
            >
              <span
                style={{
                  minWidth: 0,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {section.label}
              </span>
              {section.requirements.length > 0 && (
                <span style={{ color: accent, flexShrink: 0 }}>
                  {section.requirements.length}
                </span>
              )}
            </button>
            {section.requirements.map((requirement, requirementIndex) => {
              const reqPart: SpecPartSelection = {
                type: 'requirement',
                sectionIndex,
                requirementIndex,
              };
              return (
                <React.Fragment key={requirement.title}>
                  <button
                    className="spec-outline-item"
                    data-spec-nav-item
                    type="button"
                    aria-current={isSelected(reqPart)}
                    onClick={() => onSelect(reqPart)}
                    style={
                      {
                        ...buttonStyle(isSelected(reqPart), 1),
                        '--spec-outline-hover': theme.colors.backgroundHover,
                      } as React.CSSProperties
                    }
                  >
                    <span
                      style={{
                        minWidth: 0,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {requirement.title}
                    </span>
                  </button>
                  {requirement.scenarios.map((scenario, scenarioIndex) => {
                    const scenarioPart: SpecPartSelection = {
                      type: 'scenario',
                      sectionIndex,
                      requirementIndex,
                      scenarioIndex,
                    };
                    return (
                      <button
                        className="spec-outline-item"
                        data-spec-nav-item
                        key={scenario.title}
                        type="button"
                        aria-current={isSelected(scenarioPart)}
                        onClick={() => onSelect(scenarioPart)}
                        style={
                          {
                            ...buttonStyle(isSelected(scenarioPart), 2),
                            '--spec-outline-hover':
                              theme.colors.backgroundHover,
                          } as React.CSSProperties
                        }
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            color:
                              theme.colors.textTertiary ??
                              theme.colors.textSecondary,
                          }}
                        >
                          ·
                        </span>
                        <span
                          style={{
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {scenario.title}
                        </span>
                      </button>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
};

/** Focused overview pane: exactly one section, requirement, or scenario. */
const SelectedSpecPart: React.FC<{
  document: SpecDocument;
  selection: SpecPartSelection;
  onSelect: (part: SpecPartSelection) => void;
  onLinkClick: (href: string, event?: MouseEvent) => void;
}> = ({ document, selection, onSelect, onLinkClick }) => {
  const { theme } = useTheme();
  const current = normalizeSpecPart(document, selection);
  const section = document.sections[current.sectionIndex];
  if (!section) {
    return (
      <div
        className="spec-structured-document"
        style={{ fontFamily: theme.fonts.body }}
      >
        <p>No structured sections found. Choose Markdown to read the source.</p>
      </div>
    );
  }

  const accent = sectionAccent(section.kind, theme);
  const selectedRequirement =
    current.type === 'section'
      ? undefined
      : section.requirements[current.requirementIndex];
  const selectedScenario =
    current.type === 'scenario' && selectedRequirement
      ? selectedRequirement.scenarios[current.scenarioIndex]
      : undefined;
  const stepCount = selectedRequirement?.scenarios.length ?? 0;

  return (
    <div
      className="spec-structured-document"
      style={{ fontFamily: theme.fonts.body }}
    >
      {current.type === 'section' && (
        <>
          <header className="spec-section-header">
            <span
              style={{ color: accent, display: 'inline-flex' }}
              aria-hidden="true"
            >
              {section.requirements.length > 0 ? (
                <Layers3 size={19} />
              ) : (
                <BookOpen size={19} />
              )}
            </span>
            <h2
              style={{
                color: section.kind.startsWith('delta-')
                  ? accent
                  : theme.colors.text,
                fontSize: theme.fontSizes[4],
                lineHeight: theme.lineHeights.heading,
                fontFamily: theme.fonts.heading,
              }}
            >
              {section.label}
            </h2>
            {section.requirements.length > 0 && (
              <span
                style={{ marginLeft: 'auto', color: accent, fontWeight: 600 }}
              >
                {section.requirements.length} requirement
                {section.requirements.length === 1 ? '' : 's'}
              </span>
            )}
          </header>
          {section.body && (
            <div
              className="spec-section-prose"
              style={
                {
                  '--spec-border': theme.colors.border,
                  '--spec-surface': theme.colors.backgroundSecondary,
                } as React.CSSProperties
              }
            >
              <SpecMarkdownFragment
                content={section.body}
                prefix={`spec-section-${current.sectionIndex}`}
                accent={accent}
                onLinkClick={onLinkClick}
              />
            </div>
          )}
          {section.requirements.length > 0 && (
            <div
              className="spec-section-prompt"
              style={{
                color: theme.colors.textSecondary,
                borderColor: theme.colors.border,
                background: theme.colors.backgroundSecondary,
              }}
            >
              <Layers3 size={17} style={{ color: accent, flexShrink: 0 }} />
              <span>
                Choose a requirement in the outline to inspect its details and
                scenarios.
              </span>
            </div>
          )}
        </>
      )}

      {current.type === 'requirement' && selectedRequirement && (
        <>
          <article
            className="spec-requirement-card spec-focused-requirement"
            style={
              {
                '--spec-accent': accent,
                '--spec-border': theme.colors.border,
                '--spec-surface': theme.colors.backgroundSecondary,
                '--spec-muted': theme.colors.textSecondary,
              } as React.CSSProperties
            }
          >
            <header className="spec-requirement-header">
              <span className="spec-requirement-number">
                {String(current.requirementIndex + 1).padStart(2, '0')}
              </span>
              <h2
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.heading,
                }}
              >
                {selectedRequirement.title}
              </h2>
            </header>
            {selectedRequirement.description && (
              <div className="spec-requirement-description">
                <SpecMarkdownFragment
                  content={selectedRequirement.description}
                  prefix={`spec-requirement-${current.sectionIndex}-${current.requirementIndex}`}
                  accent={accent}
                  onLinkClick={onLinkClick}
                />
              </div>
            )}
            {stepCount > 0 && (
              <div
                className="spec-focused-scenarios"
                style={
                  {
                    '--spec-muted': theme.colors.textSecondary,
                    '--spec-surface': theme.colors.backgroundSecondary,
                  } as React.CSSProperties
                }
              >
                <div className="spec-focused-subtitle">
                  Scenarios <span>{stepCount}</span>
                </div>
                {selectedRequirement.scenarios.map(
                  (scenario, scenarioIndex) => (
                    <button
                      key={scenario.title}
                      type="button"
                      className="spec-scenario-card spec-scenario-picker"
                      onClick={() =>
                        onSelect({
                          type: 'scenario',
                          sectionIndex: current.sectionIndex,
                          requirementIndex: current.requirementIndex,
                          scenarioIndex,
                        })
                      }
                      style={
                        {
                          '--spec-border': theme.colors.border,
                          '--spec-surface': theme.colors.backgroundSecondary,
                          '--spec-muted': theme.colors.textSecondary,
                          '--spec-text': theme.colors.text,
                        } as React.CSSProperties
                      }
                    >
                      <span className="spec-scenario-number">
                        {String(scenarioIndex + 1).padStart(2, '0')}
                      </span>
                      <span className="spec-scenario-picker-title">
                        {scenario.title}
                      </span>
                      <span className="spec-open-affordance">
                        View scenario →
                      </span>
                    </button>
                  ),
                )}
              </div>
            )}
          </article>
        </>
      )}

      {current.type === 'scenario' &&
        selectedRequirement &&
        selectedScenario && (
          <>
            <section
              className="spec-scenario-card spec-focused-scenario"
              style={
                {
                  '--spec-border': theme.colors.border,
                  '--spec-surface': theme.colors.backgroundSecondary,
                  '--spec-muted': theme.colors.textSecondary,
                  '--spec-accent': accent,
                } as React.CSSProperties
              }
            >
              <header className="spec-focused-scenario-header">
                <span className="spec-scenario-number">
                  {String(current.scenarioIndex + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.fonts.heading,
                    }}
                  >
                    {selectedScenario.title}
                  </h2>
                </div>
              </header>
              {selectedScenario.body && (
                <div className="spec-focused-scenario-body">
                  <SpecMarkdownFragment
                    content={selectedScenario.body}
                    prefix={`spec-scenario-${current.sectionIndex}-${current.requirementIndex}-${current.scenarioIndex}`}
                    accent={accent}
                    onLinkClick={onLinkClick}
                  />
                </div>
              )}
            </section>
          </>
        )}
    </div>
  );
};

/** Normalized requirement-title key → scenario count, from the parsed outline. */
function scenarioCountByRequirement(outline: SpecOutline): Map<string, number> {
  const map = new Map<string, number>();
  for (const section of outline.sections) {
    for (const requirement of section.requirements) {
      const key = requirement.title.toLowerCase().replace(/\s+/g, ' ').trim();
      map.set(key, requirement.scenarioTitles.length);
    }
  }
  return map;
}

/**
 * The reading region. The outline is read from the *rendered* heading DOM
 * (`rehype-slug` ids) rather than re-parsed from markdown — that guarantees a
 * rail click can `scrollIntoView` the real node — and scenario counts are
 * decorated onto rows via the parsed outline (see
 * `TopicDescriptionBody` for the origin of this approach).
 */
const SpecBody: React.FC<SpecBodyProps> = ({
  content,
  outline,
  document,
  filePath,
  repositoryPath,
  events,
}) => {
  const { theme } = useTheme();
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [mode, setMode] = React.useState<SpecReaderMode>(() =>
    parseSpecPath(filePath) ? 'overview' : 'markdown',
  );
  const [selectedPart, setSelectedPart] = React.useState<SpecPartSelection>(
    () => initialSpecPart(document),
  );
  const currentSelection = useMemo(
    () => normalizeSpecPart(document, selectedPart),
    [document, selectedPart],
  );

  // Doc-link handling mirrors MarkdownPanel: external links go to the OS
  // browser, `#anchors` scroll, relative links resolve against the spec's
  // directory and emit `file:opened` (the host opens the matching tab — spec
  // links land right back in a spec tab via `openFileByPath` routing).
  const docDir = useMemo(() => {
    const i = filePath.lastIndexOf('/');
    return i > 0 ? filePath.slice(0, i) : undefined;
  }, [filePath]);
  const { onLinkClick, notice, dismissNotice, openCandidate } =
    useMarkdownLinkHandler({
      events,
      repositoryPath,
      basePath: docDir,
      source: 'spec-tab',
    });

  const scenarioCounts = useMemo(
    () => scenarioCountByRequirement(outline),
    [outline],
  );

  // Build the rail from the rendered heading DOM: h2s are groups, h3s their
  // requirement rows. Both visual and raw modes share the same heading outline.
  const [rail, setRail] = React.useState<RailGroup[]>([]);
  React.useEffect(() => {
    if (mode !== 'markdown') return;
    const root = wrapperRef.current;
    if (!root) return;
    const raf = requestAnimationFrame(() => {
      const nodes = root.querySelectorAll<HTMLElement>(':is(h2, h3)[id]');
      const groups: RailGroup[] = [];
      nodes.forEach((node) => {
        const text = (node.textContent ?? '').trim();
        if (!text) return;
        if (node.tagName === 'H2') {
          groups.push({ id: node.id, label: text, items: [] });
        } else {
          const group = groups[groups.length - 1];
          if (!group) return;
          const title = text.replace(/^Requirement:\s*/, '');
          group.items.push({
            id: node.id,
            title,
            scenarioCount: scenarioCounts.get(
              title.toLowerCase().replace(/\s+/g, ' ').trim(),
            ),
          });
        }
      });
      setRail((prev) =>
        prev.length === groups.length &&
        prev.every(
          (p, i) =>
            p.id === groups[i].id &&
            p.label === groups[i].label &&
            p.items.length === groups[i].items.length,
        )
          ? prev
          : groups,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [content, mode, scenarioCounts]);

  // Track the last heading above the reading line so the rail follows the
  // reader. Scroll events don't bubble, but the capture phase sees the ones
  // from DocumentView's own scroll container (same trick as the topic body).
  const [activeHeadingId, setActiveHeadingId] = React.useState<string | null>(
    null,
  );
  React.useEffect(() => {
    if (mode !== 'markdown') return;
    const root = wrapperRef.current;
    if (!root) return;
    const headings = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(':is(h1, h2, h3, h4, h5, h6)[id]'),
      ).filter((heading) => heading.textContent?.trim());
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const list = headings();
      const readingLine =
        root.getBoundingClientRect().top + root.clientTop + 24;
      let active = list[0]?.id ?? null;
      for (const heading of list) {
        if (heading.getBoundingClientRect().top > readingLine) break;
        active = heading.id;
      }
      setActiveHeadingId(active);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    schedule();
    root.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      root.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [content, mode]);

  React.useEffect(() => {
    if (mode === 'overview' && wrapperRef.current) {
      wrapperRef.current.scrollTop = 0;
    }
  }, [mode, currentSelection]);

  const scrollToHeading = React.useCallback((id: string) => {
    const root = wrapperRef.current;
    // CSS.escape: slug ids can contain selector-hostile characters.
    const target = root?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const activeGroupFor = (headingId: string | null): string | null => {
    if (!headingId) return null;
    for (const group of rail) {
      if (group.id === headingId) return group.id;
      if (group.items.some((item) => item.id === headingId)) return group.id;
    }
    return null;
  };

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: theme.fonts.body,
        backgroundColor: theme.colors.backgroundDark ?? theme.colors.background,
      }}
    >
      <div
        role="tablist"
        aria-label="Spec view"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '7px 12px',
          borderBottom: `1px solid ${theme.colors.border}`,
          background: theme.colors.backgroundSecondary,
          flexShrink: 0,
        }}
      >
        {(
          [
            ['overview', 'Overview', BookOpen],
            ['markdown', 'Markdown', FileCode2],
          ] as const
        ).map(([value, label, Icon]) => {
          const selected = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMode(value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 10px',
                border: 'none',
                borderRadius: 7,
                background: selected ? theme.colors.background : 'transparent',
                color: selected
                  ? theme.colors.text
                  : theme.colors.textSecondary,
                boxShadow: selected
                  ? `0 1px 3px ${theme.colors.border}`
                  : 'none',
                fontSize: theme.fontSizes[1],
                fontWeight: selected ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
        <span
          style={{
            marginLeft: 'auto',
            color: theme.colors.textTertiary ?? theme.colors.textSecondary,
            fontSize: theme.fontSizes[0],
          }}
        >
          {mode === 'overview' ? 'Structured spec reader' : 'Source markdown'}
        </span>
      </div>

      <div
        style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}
      >
        {/* Overview selects one semantic part; Markdown retains heading links. */}
        {mode === 'overview' ? (
          <SpecPartNavigation
            document={document}
            selection={currentSelection}
            onSelect={setSelectedPart}
          />
        ) : rail.length > 0 ? (
          <nav
            aria-label="Spec outline"
            style={{
              width: 240,
              flexShrink: 0,
              borderRight: `1px solid ${theme.colors.border}`,
              overflowY: 'auto',
              padding: '12px 8px 24px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {rail.map((group) => {
              const groupActive = activeGroupFor(activeHeadingId) === group.id;
              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => scrollToHeading(group.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: groupActive
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                      fontSize: theme.fontSizes[1],
                      fontWeight: 600,
                      lineHeight: theme.lineHeights.tight,
                      fontFamily: 'inherit',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer',
                    }}
                  >
                    {group.label}
                  </button>
                  {group.items.length > 0 && (
                    <ul
                      style={{
                        listStyle: 'none',
                        margin: '6px 0 0',
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {group.items.map((item) => {
                        const itemActive = activeHeadingId === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => scrollToHeading(item.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 6,
                                width: '100%',
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: 'none',
                                background: itemActive
                                  ? theme.colors.backgroundSecondary
                                  : 'transparent',
                                color: itemActive
                                  ? theme.colors.primary
                                  : theme.colors.text,
                                fontSize: theme.fontSizes[1],
                                fontWeight: 400,
                                lineHeight: theme.lineHeights.tight,
                                fontFamily: 'inherit',
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <span
                                style={{
                                  minWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.title}
                              </span>
                              {typeof item.scenarioCount === 'number' &&
                                item.scenarioCount > 0 && (
                                  <span
                                    style={{
                                      flexShrink: 0,
                                      padding: '1px 6px',
                                      borderRadius: 999,
                                      background:
                                        theme.colors.backgroundTertiary,
                                      color: theme.colors.textSecondary,
                                      fontSize: theme.fontSizes[0],
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {item.scenarioCount}
                                  </span>
                                )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        ) : null}

        {/* The Overview pane shows one selected part, never the full spec stack. */}
        <div
          ref={wrapperRef}
          className="spec-reader-content"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            overflowY: mode === 'overview' ? 'auto' : 'hidden',
            overflowX: 'hidden',
          }}
        >
          {mode === 'overview' ? (
            <SelectedSpecPart
              document={document}
              selection={currentSelection}
              onSelect={setSelectedPart}
              onLinkClick={onLinkClick}
            />
          ) : (
            <DocumentView
              content={content}
              theme={theme}
              slideIdPrefix="spec-tab"
              maxWidth="900px"
              onLinkClick={onLinkClick}
            />
          )}
        </div>
      </div>

      {notice && (
        <MarkdownLinkNotice
          notice={notice}
          onDismiss={dismissNotice}
          onChoose={openCandidate}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Tab body: header + loading / error / empty states
// ----------------------------------------------------------------------------

export const SpecTabContent: React.FC<SpecTabContentProps> = ({
  filePath,
  repositoryPath,
  events,
}) => {
  const { theme } = useTheme();
  // Stories run without a hosting panel framework; a private bus keeps the
  // link handler wired (relative-link clicks become local no-ops there).
  const fallbackBus = useMemo(() => new PanelEventBus(), []);
  const bus = events ?? fallbackBus;

  const specInfo = parseSpecPath(filePath);
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const [copiedPath, setCopiedPath] = React.useState(false);
  const copyResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = React.useCallback(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    FileSystemService.readFile(filePath)
      .then((result) => {
        if (cancelled) return;
        const content = result?.content ?? '';
        if (!content.trim()) {
          setState({ status: 'empty' });
          return;
        }
        setState({
          status: 'ready',
          content,
          outline: parseSpecMarkdown(content),
          document: parseSpecDocument(content),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Failed to read spec file',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  React.useEffect(() => reload(), [reload, reloadNonce]);
  useFileWatch(filePath, reload);

  // Copy-path confirmation reset (mirrors the topic tab's copy button).
  React.useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    [],
  );
  const copyPath = React.useCallback(() => {
    try {
      void navigator.clipboard?.writeText(filePath);
      setCopiedPath(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopiedPath(false), 1500);
    } catch {
      // navigator.clipboard can reject in restricted webviews; no-op.
    }
  }, [filePath]);

  const headerButtonStyle = React.useCallback(
    (highlight: boolean): React.CSSProperties => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      flexShrink: 0,
      padding: 0,
      borderRadius: 6,
      border: `1px solid ${highlight ? theme.colors.primary : theme.colors.border}`,
      background: theme.colors.backgroundSecondary,
      color: highlight ? theme.colors.primary : theme.colors.text,
      cursor: 'pointer',
    }),
    [theme],
  );

  // Breadcrumb: repo / [change /] capability, from the OpenSpec path layout.
  const breadcrumb = useMemo(() => {
    const segments: string[] = [];
    const root =
      repositoryPath ??
      (specInfo?.repositoryRoot
        ? repoName(specInfo.repositoryRoot)
        : undefined);
    if (root) segments.push(repoName(root));
    if (specInfo) {
      if (specInfo.kind === 'change' && specInfo.change)
        segments.push(specInfo.change);
      segments.push(specInfo.capability);
    } else {
      segments.push(filePath.split('/').pop() || 'spec.md');
    }
    return segments;
  }, [repositoryPath, specInfo, filePath]);

  // Delta chips: one per `## <KIND> Requirements` section, with counts.
  const deltaChips = useMemo(() => {
    if (!specInfo || specInfo.kind !== 'change' || state.status !== 'ready') {
      return [];
    }
    return state.outline.sections
      .filter(
        (
          section,
        ): section is typeof section & { kind: `delta-${DeltaSectionKind}` } =>
          section.kind.startsWith('delta-'),
      )
      .map((section) => ({
        kind: section.kind.slice('delta-'.length) as DeltaSectionKind,
        count: section.requirements.length,
      }));
  }, [specInfo, state]);

  const chipColor = (
    tone: 'success' | 'warning' | 'error' | 'info' | 'muted',
  ) => (tone === 'muted' ? theme.colors.textSecondary : theme.colors[tone]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: theme.fonts.body,
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
          }}
        >
          <ScrollText
            size={18}
            style={{ color: theme.colors.primary, flexShrink: 0 }}
          />
          <h1
            style={{
              flex: 1,
              minWidth: 0,
              margin: 0,
              fontSize: theme.fontSizes[4],
              fontWeight: 700,
              fontFamily: theme.fonts.heading,
              color: theme.colors.text,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {state.status === 'ready' && state.outline.title
              ? state.outline.title
              : (specInfo?.capability ?? 'Spec')}
          </h1>
          {state.status === 'ready' && specInfo && (
            <span
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 999,
                background: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[1],
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
              }}
            >
              {specInfo?.kind === 'change' ? 'Change delta' : 'Capability spec'}
            </span>
          )}
          <button
            type="button"
            onClick={copyPath}
            aria-label="Copy spec file path"
            style={headerButtonStyle(copiedPath)}
          >
            {copiedPath ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            aria-label="Reload spec"
            style={headerButtonStyle(false)}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {breadcrumb.join(' / ')}
          </span>
          {deltaChips.map(({ kind, count }) => (
            <span
              key={kind}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '1px 8px',
                borderRadius: 999,
                border: `1px solid ${chipColor(DELTA_CHIP_COLORS[kind])}`,
                color: chipColor(DELTA_CHIP_COLORS[kind]),
                fontSize: theme.fontSizes[1],
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
              }}
            >
              {kind}
              {count > 0 ? ` ${count}` : ''}
            </span>
          ))}
          {state.status === 'ready' && specInfo && (
            <span
              style={{
                flexShrink: 0,
                marginLeft: 'auto',
                color: theme.colors.textTertiary ?? theme.colors.textSecondary,
                fontSize: theme.fontSizes[1],
                whiteSpace: 'nowrap',
              }}
            >
              {state.outline.requirementCount} requirement
              {state.outline.requirementCount === 1 ? '' : 's'} ·{' '}
              {state.outline.scenarioCount} scenario
              {state.outline.scenarioCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {state.status === 'loading' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: theme.colors.textSecondary,
            backgroundColor:
              theme.colors.backgroundDark ?? theme.colors.background,
          }}
        >
          <RefreshCw
            size={16}
            style={{ animation: 'spin 0.8s linear infinite' }}
          />
          <span>Loading spec…</span>
        </div>
      )}
      {state.status === 'empty' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: theme.colors.textSecondary,
            backgroundColor:
              theme.colors.backgroundDark ?? theme.colors.background,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <ScrollText size={28} style={{ opacity: 0.5 }} />
          <span>This spec file is empty.</span>
          <span
            style={{
              color: theme.colors.textTertiary ?? theme.colors.textSecondary,
            }}
          >
            {filePath}
          </span>
        </div>
      )}
      {state.status === 'error' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: theme.colors.textSecondary,
            backgroundColor:
              theme.colors.backgroundDark ?? theme.colors.background,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <AlertTriangle size={28} style={{ color: theme.colors.error }} />
          <span>Couldn’t read this spec file.</span>
          <span
            style={{
              color: theme.colors.error,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: theme.fontSizes[1],
            }}
          >
            {state.message}
          </span>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <SpecBody
          key={filePath}
          content={state.content}
          outline={state.outline}
          document={state.document}
          filePath={filePath}
          repositoryPath={repositoryPath}
          events={bus}
        />
      )}
    </div>
  );
};

export default SpecTabContent;

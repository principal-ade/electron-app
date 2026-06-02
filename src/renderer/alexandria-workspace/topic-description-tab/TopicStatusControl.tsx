/**
 * Compact editor for a topic's workflow status, rendered under the slide-over
 * header. A row of state buttons (active / needs-attention / waiting / done)
 * drives the structured axis; a label field overrides the displayed text; and
 * when the state is `waiting`, a small `waitingOn` sub-form captures what the
 * topic is parked on (note / until / ref) so automations can later resolve it.
 *
 * State-button clicks save immediately; text fields save on blur. Persistence
 * goes through `TopicService.updateTopic`, which writes through to web-ade for
 * published topics — so `until` is entered as a date to stay ISO 8601.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { TopicStatus } from '@principal-ai/alexandria-core-library';
import { TopicService } from '../../main-process-api/TopicService';

type TopicStatusState = TopicStatus['state'];
type RefKind = NonNullable<NonNullable<TopicStatus['waitingOn']>['ref']>['kind'];
type ThemeShape = ReturnType<typeof useTheme>['theme'];

const STATES: ReadonlyArray<{ value: TopicStatusState; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'needs-attention', label: 'Needs attention' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Done' },
];

const REF_KINDS: readonly RefKind[] = ['url', 'pr', 'issue', 'topic', 'trail'];

/** State color — keyed off the structured axis, matching the home-card pill. */
function stateColor(state: TopicStatusState, theme: ThemeShape): string {
  switch (state) {
    case 'needs-attention':
      return theme.colors.warning;
    case 'waiting':
      return theme.colors.info;
    case 'done':
      return theme.colors.success;
    case 'active':
    default:
      return theme.colors.textTertiary;
  }
}

export interface TopicStatusControlProps {
  topicId: string;
  /** Current status from the loaded topic; absent is treated as `active`. */
  status?: TopicStatus;
}

export const TopicStatusControl: React.FC<TopicStatusControlProps> = ({
  topicId,
  status,
}) => {
  const { theme } = useTheme();

  // Local draft, seeded from the topic. Re-seeds when the topic changes (so
  // switching topics resets the form) but not on every prop change, so a live
  // refresh from onTopicChange won't clobber an in-progress edit.
  const [state, setState] = useState<TopicStatusState>(status?.state ?? 'active');
  const [label, setLabel] = useState(status?.label ?? '');
  const [note, setNote] = useState(status?.waitingOn?.note ?? '');
  const [until, setUntil] = useState(status?.waitingOn?.until?.slice(0, 10) ?? '');
  const [refKind, setRefKind] = useState<RefKind>(
    status?.waitingOn?.ref?.kind ?? 'url',
  );
  const [refValue, setRefValue] = useState(status?.waitingOn?.ref?.value ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setState(status?.state ?? 'active');
    setLabel(status?.label ?? '');
    setNote(status?.waitingOn?.note ?? '');
    setUntil(status?.waitingOn?.until?.slice(0, 10) ?? '');
    setRefKind(status?.waitingOn?.ref?.kind ?? 'url');
    setRefValue(status?.waitingOn?.ref?.value ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const build = (overrides: {
    state: TopicStatusState;
    label: string;
    note: string;
    until: string;
    refKind: RefKind;
    refValue: string;
  }): TopicStatus => {
    const next: TopicStatus = { state: overrides.state };
    const trimmedLabel = overrides.label.trim();
    if (trimmedLabel) next.label = trimmedLabel;
    if (overrides.state === 'waiting') {
      const waitingOn: NonNullable<TopicStatus['waitingOn']> = {};
      if (overrides.note.trim()) waitingOn.note = overrides.note.trim();
      if (overrides.until.trim()) waitingOn.until = overrides.until.trim();
      if (overrides.refValue.trim())
        waitingOn.ref = { kind: overrides.refKind, value: overrides.refValue.trim() };
      if (Object.keys(waitingOn).length > 0) next.waitingOn = waitingOn;
    }
    return next;
  };

  const save = async (next: TopicStatus) => {
    setSaving(true);
    try {
      await TopicService.updateTopic(topicId, { status: next });
    } catch (err) {
      console.error('[TopicStatusControl] save failed', err);
    } finally {
      setSaving(false);
    }
  };

  const current = useMemo(
    () => ({ state, label, note, until, refKind, refValue }),
    [state, label, note, until, refKind, refValue],
  );

  const selectState = (value: TopicStatusState) => {
    setState(value);
    void save(build({ ...current, state: value }));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '4px 8px',
    borderRadius: 6,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.backgroundSecondary,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes[1],
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
        }}
      >
        <span style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Status
        </span>
        {saving && (
          <span style={{ color: theme.colors.textTertiary }}>saving…</span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {STATES.map((s) => {
          const selected = s.value === state;
          const color = stateColor(s.value, theme);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => selectState(s.value)}
              style={{
                padding: '2px 8px',
                fontSize: theme.fontSizes[0],
                fontFamily: theme.fonts.body,
                borderRadius: 5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                color: selected ? theme.colors.background : color,
                background: selected ? color : 'transparent',
                border: `1px solid ${color}`,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={label}
        placeholder="Custom label (optional)"
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => void save(build(current))}
        style={inputStyle}
      />

      {state === 'waiting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            value={note}
            placeholder="Waiting on… (e.g. design sign-off)"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => void save(build(current))}
            style={inputStyle}
          />
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            onBlur={() => void save(build(current))}
            style={inputStyle}
            title="Revisit after this date"
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={refKind}
              onChange={(e) => setRefKind(e.target.value as RefKind)}
              onBlur={() => void save(build(current))}
              style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}
            >
              {REF_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={refValue}
              placeholder="Link / id it's waiting on"
              onChange={(e) => setRefValue(e.target.value)}
              onBlur={() => void save(build(current))}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicStatusControl;

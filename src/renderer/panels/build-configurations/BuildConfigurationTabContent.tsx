/**
 * BuildConfigurationTabContent
 *
 * Read-only view of a build configuration (topic-1793592184227).
 * Presentational only: no main-process calls, no secret values, no
 * approve/run actions yet. For Storybook first, tab wiring later.
 */

import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { parsePurl } from '@principal-ai/alexandria-core-library';
import { ProjectRepoCard } from '../cards/ProjectRepoCard';

import {
  resolveBuildCheckoutDir,
  type BuildCheckout,
  type BuildCommand,
  type BuildSecretDecl,
} from '../../../shared/build-configurations/types';

export interface BuildSecretView extends BuildSecretDecl {
  /** Presentational only — whether a value has been granted. Never the value. */
  granted: boolean;
}

export interface BuildConfigurationView {
  id: string;
  name: string;
  repo: string;
  checkout: BuildCheckout;
  command: BuildCommand;
  secrets: BuildSecretView[];
  /** Whether the user confirmed this exact content. Enables Run upstream. */
  confirmed: boolean;
}

export interface BuildConfigurationTabContentProps {
  config: BuildConfigurationView;
  /**
   * Called with (env, value) when the user saves a token. The value is
   * cleared from the form immediately; it is never stored in UI state.
   * The real tab forwards this to SecretsService.update.
   */
  onSaveSecret?: (env: string, value: string) => void;
  /** Called when the user clears a granted token. */
  onClearSecret?: (env: string) => void;
  /** Called when the user confirms the secret set for this content. */
  onConfirmSecrets?: () => void;
  /** Called when the user runs the build. Renders right of the name. */
  onRunBuild?: () => void;
  runBuildDisabled?: boolean;
  runBuildTitle?: string;
  /** Called when the user declares a new secret. */
  onAddSecret?: (decl: {
    env: string;
    label: string;
    required: boolean;
  }) => void;
  /** Called when the user removes a secret declaration. */
  onRemoveSecret?: (env: string) => void;
  /** Called when the user edits a secret declaration. */
  onEditSecret?: (
    oldEnv: string,
    decl: { env: string; label: string; required: boolean },
  ) => void;
  /** Called with source/target indexes after a drag reorder. */
  onReorderSecrets?: (from: number, to: number) => void;
  /**
   * The builds directory a null checkout path resolves under. When absent
   * the runs-in row says the build dir is not set instead of guessing.
   */
  buildsDirectory?: string | null;
}

function ActionButton({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 12px',
        background: primary ? theme.colors.primary : 'none',
        border: `1px solid ${primary ? theme.colors.primary : theme.colors.border}`,
        borderRadius: 6,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[0],
        color: primary ? theme.colors.background : theme.colors.text,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function SecretRow({
  secret,
  index,
  draggable,
  isDropTarget,
  onSaveSecret,
  onClearSecret,
  onRemoveSecret,
  onEditSecret,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  onRowDragEnd,
  otherEnvs,
}: {
  secret: BuildSecretView;
  index: number;
  draggable?: boolean;
  isDropTarget?: boolean;
  /** Env names of the sibling rows, for duplicate checking while editing. */
  otherEnvs: string[];
  onSaveSecret?: (env: string, value: string) => void;
  onClearSecret?: (env: string) => void;
  onRemoveSecret?: (env: string) => void;
  onEditSecret?: (
    oldEnv: string,
    decl: { env: string; label: string; required: boolean },
  ) => void;
  onRowDragStart?: (index: number) => void;
  onRowDragOver?: (index: number) => void;
  onRowDrop?: () => void;
  onRowDragEnd?: () => void;
}) {
  const { theme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [editingDecl, setEditingDecl] = useState(false);
  const [value, setValue] = useState('');
  const ok = secret.granted;
  const color = ok ? theme.colors.success : theme.colors.warning;

  const cancel = () => {
    setValue('');
    setEditing(false);
  };
  const save = () => {
    if (value.length === 0) return;
    onSaveSecret?.(secret.env, value);
    cancel();
  };

  if (editingDecl && onEditSecret) {
    return (
      <SecretDeclForm
        existing={otherEnvs}
        initial={{
          env: secret.env,
          label: secret.label,
          required: secret.required,
        }}
        submitLabel="Save"
        onSubmit={(decl) => {
          onEditSecret(secret.env, decl);
          setEditingDecl(false);
        }}
        onCancel={() => setEditingDecl(false)}
      />
    );
  }

  return (
    <div
      draggable={draggable && !editing}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', secret.env);
        event.dataTransfer.effectAllowed = 'move';
        onRowDragStart?.(index);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onRowDragOver?.(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onRowDrop?.();
      }}
      onDragEnd={() => onRowDragEnd?.()}
      style={{
        border: `1px solid ${isDropTarget ? theme.colors.primary : theme.colors.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        background: isDropTarget ? `${theme.colors.primary}08` : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {draggable && (
          <span
            title="Drag to reorder"
            style={{
              display: 'inline-flex',
              cursor: 'grab',
              color: theme.colors.textMuted,
              flexShrink: 0,
            }}
          >
            <GripVertical size={14} />
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: theme.fonts.monospace,
              fontSize: theme.fontSizes[1],
              color: theme.colors.text,
              overflowWrap: 'anywhere',
            }}
          >
            {secret.env}
          </div>
          <div
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textMuted,
            }}
          >
            {secret.label}
            {secret.required ? '' : ' · optional'}
          </div>
        </div>
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            fontWeight: theme.fontWeights.semibold,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color,
            border: `1px solid ${color}60`,
            background: `${color}12`,
            borderRadius: 999,
            padding: '2px 10px',
            whiteSpace: 'nowrap',
          }}
        >
          {ok ? 'granted' : 'missing'}
        </span>
        {onSaveSecret && !editing && !editingDecl && (
          <ActionButton onClick={() => setEditing(true)}>
            {ok ? 'Update' : 'Set'}
          </ActionButton>
        )}
        {onClearSecret && ok && !editing && !editingDecl && (
          <ActionButton onClick={() => onClearSecret(secret.env)}>
            Clear
          </ActionButton>
        )}
        {onEditSecret && !editing && !editingDecl && (
          <ActionButton onClick={() => setEditingDecl(true)}>Edit</ActionButton>
        )}
        {onRemoveSecret && !editing && !editingDecl && (
          <ActionButton onClick={() => onRemoveSecret(secret.env)}>
            Remove
          </ActionButton>
        )}
      </div>
      {editing && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
              if (event.key === 'Escape') cancel();
            }}
            placeholder={`Paste ${secret.env} value`}
            autoFocus
            style={{
              flex: 1,
              minWidth: 0,
              padding: '6px 10px',
              background: theme.colors.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 6,
              fontFamily: theme.fonts.monospace,
              fontSize: theme.fontSizes[1],
              color: theme.colors.text,
            }}
          />
          <ActionButton primary onClick={save} disabled={value.length === 0}>
            Save
          </ActionButton>
          <ActionButton onClick={cancel}>Cancel</ActionButton>
        </div>
      )}
    </div>
  );
}

const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function SecretDeclForm({
  existing,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  existing: string[];
  initial?: { env: string; label: string; required: boolean };
  submitLabel: string;
  onSubmit: (decl: { env: string; label: string; required: boolean }) => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const [env, setEnv] = useState(initial?.env ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [required, setRequired] = useState(initial?.required ?? true);
  const trimmed = env.trim();
  const valid =
    ENV_NAME_PATTERN.test(trimmed) &&
    !existing.includes(trimmed) &&
    label.trim().length > 0;
  const inputStyle = (mono: boolean): React.CSSProperties => ({
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 10px',
    background: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 6,
    fontFamily: mono ? theme.fonts.monospace : theme.fonts.body,
    fontSize: theme.fontSizes[1],
    color: theme.colors.text,
  });
  return (
    <div
      style={{
        border: `1px dashed ${theme.colors.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <input
        value={env}
        onChange={(event) => setEnv(event.target.value)}
        placeholder="ENV_NAME"
        autoFocus
        aria-label="Environment variable name"
        style={inputStyle(true)}
      />
      <input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Human label, e.g. npm token"
        aria-label="Secret label"
        style={inputStyle(false)}
      />
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
        }}
      >
        <input
          type="checkbox"
          checked={required}
          onChange={(event) => setRequired(event.target.checked)}
        />
        Required for builds
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <ActionButton
          primary
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            onSubmit({ env: trimmed, label: label.trim(), required });
          }}
        >
          {submitLabel}
        </ActionButton>
        <ActionButton onClick={onCancel}>Cancel</ActionButton>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        fontWeight: theme.fontWeights.semibold,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.colors.textSecondary,
        margin: '20px 0 8px',
      }}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '4px 0',
        alignItems: 'baseline',
      }}
    >
      <div
        style={{
          width: 140,
          flexShrink: 0,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          color: theme.colors.textMuted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowWrap: 'anywhere',
          fontFamily: mono ? theme.fonts.monospace : theme.fonts.body,
          fontSize: theme.fontSizes[1],
          color: theme.colors.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function resetLabel(reset: 'ff-only' | 'clean' | 'none'): string {
  switch (reset) {
    case 'ff-only':
      return 'Fast-forward only';
    case 'clean':
      return 'Wipe and reset';
    case 'none':
      return 'Leave as-is';
  }
}

export const BuildConfigurationTabContent: React.FC<
  BuildConfigurationTabContentProps
> = ({
  config,
  onSaveSecret,
  onClearSecret,
  onConfirmSecrets,
  onRunBuild,
  runBuildDisabled,
  runBuildTitle,
  onAddSecret,
  onRemoveSecret,
  onEditSecret,
  onReorderSecrets,
  buildsDirectory,
}) => {
  const { theme } = useTheme();
  const missing = config.secrets.filter((s) => s.required && !s.granted);
  const parsed = parsePurl(config.repo);
  const repoCardData =
    parsed?.namespace && parsed.namespace !== 'local'
      ? { repoName: parsed.name, ownerLogin: parsed.namespace }
      : { repoName: config.repo };
  const runsIn = resolveBuildCheckoutDir({
    checkoutPath: config.checkout.path,
    cwd: config.command.cwd,
    repo: config.repo,
    buildsDirectory: buildsDirectory ?? null,
  });
  const [showCheckout, setShowCheckout] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const endDrag = () => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      onReorderSecrets?.(dragIndex, dropIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        background: theme.colors.background,
      }}
    >
      <div
        style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 40px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[4],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
              overflowWrap: 'anywhere',
            }}
          >
            {config.name}
          </div>
          {onRunBuild && (
            <button
              type="button"
              onClick={onRunBuild}
              disabled={runBuildDisabled}
              title={runBuildTitle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                cursor: runBuildDisabled ? 'default' : 'pointer',
                opacity: runBuildDisabled ? 0.5 : 1,
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}dd)`,
                color: theme.colors.background,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.semibold,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Run build
            </button>
          )}
        </div>

        <SectionTitle>Repository</SectionTitle>
        <ProjectRepoCard repo={repoCardData} dense />
        <button
          type="button"
          onClick={() => setShowCheckout((open) => !open)}
          aria-expanded={showCheckout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            padding: '4px 2px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
          }}
        >
          {showCheckout ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          Checkout details
        </button>
        {showCheckout && (
          <div
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 8,
              padding: '12px 14px',
              marginTop: 4,
            }}
          >
            <Row label="Revision" value={config.checkout.ref} mono />
            <Row
              label="History depth"
              value={
                config.checkout.depth === 1
                  ? '1 commit (shallow)'
                  : `${config.checkout.depth} commits`
              }
              mono
            />
            <Row
              label="Existing checkout"
              value={resetLabel(config.checkout.reset)}
              mono
            />
          </div>
        )}

        <SectionTitle>Command</SectionTitle>
        <div
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <Row label="Line" value={config.command.line} mono />
          <Row
            label="Timeout"
            value={`${Math.round(config.command.timeoutMs / 1000)}s`}
            mono
          />
          {runsIn ? (
            <Row label="Runs in" value={runsIn} mono />
          ) : (
            <Row
              label="Runs in"
              value="Build directory not set — pick one in Settings → General, or set an explicit checkout path."
            />
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            margin: '20px 0 8px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.semibold,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: theme.colors.textSecondary,
              }}
            >
              Secrets
              {missing.length > 0
                ? ` — ${missing.length} missing`
                : ' — all granted'}
            </div>
          </div>
          {onConfirmSecrets && !config.confirmed && (
            <ActionButton
              primary
              onClick={onConfirmSecrets}
              disabled={missing.length > 0}
            >
              <span
                title={
                  missing.length > 0
                    ? `Grant first: ${missing.map((secret) => secret.env).join(', ')}`
                    : 'Confirm these secrets for this exact command and revision'
                }
              >
                Confirm secrets
              </span>
            </ActionButton>
          )}
        </div>
        {config.confirmed && (
          <div
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              color: theme.colors.success,
              marginBottom: 8,
            }}
          >
            Confirmed for this exact command and revision. Any edit to the repo,
            revision, command, or secret names clears it.
          </div>
        )}
        {config.secrets.length === 0 && !adding ? (
          <div
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              color: theme.colors.textMuted,
            }}
          >
            No secrets declared. Runs without a secret grant.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {config.secrets.map((secret, index) => (
              <SecretRow
                key={secret.env}
                secret={secret}
                index={index}
                draggable={!!onReorderSecrets}
                isDropTarget={dropIndex === index && dragIndex !== index}
                otherEnvs={config.secrets
                  .map((sibling) => sibling.env)
                  .filter((env) => env !== secret.env)}
                onSaveSecret={onSaveSecret}
                onClearSecret={onClearSecret}
                onRemoveSecret={onRemoveSecret}
                onEditSecret={onEditSecret}
                onRowDragStart={setDragIndex}
                onRowDragOver={setDropIndex}
                onRowDrop={endDrag}
                onRowDragEnd={endDrag}
              />
            ))}
            {adding ? (
              <SecretDeclForm
                existing={config.secrets.map((secret) => secret.env)}
                submitLabel="Add"
                onSubmit={(decl) => {
                  onAddSecret?.(decl);
                  setAdding(false);
                }}
                onCancel={() => setAdding(false)}
              />
            ) : (
              onAddSecret && (
                <div>
                  <ActionButton onClick={() => setAdding(true)}>
                    Add secret
                  </ActionButton>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildConfigurationTabContent;

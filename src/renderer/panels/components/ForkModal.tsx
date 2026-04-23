import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Loader2, AlertCircle, Check, GitFork } from 'lucide-react';
import { GithubService } from '../../main-process-api/GithubService';
import { GitService } from '../../main-process-api/GitService';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import type { GitHubUser, GitHubOrganization } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

interface ForkModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoOwner: string;
  repoName: string;
  registerRepository: (name: string, path: string) => Promise<AlexandriaEntry>;
}

type Step = 'select' | 'progress' | 'complete';
type ProgressStep = 'forking' | 'cloning' | 'registering' | 'adding';

function joinPath(...parts: string[]): string {
  return parts
    .map((part, i) => (i === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, '')))
    .filter(Boolean)
    .join('/');
}

export const ForkModal: React.FC<ForkModalProps> = ({ isOpen, onClose, repoOwner, repoName, registerRepository }) => {
  const { theme } = useTheme();

  const [step, setStep] = useState<Step>('select');
  const [progressStep, setProgressStep] = useState<ProgressStep>('forking');

  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null);
  const [organizations, setOrganizations] = useState<GitHubOrganization[]>([]);
  const [forkTarget, setForkTarget] = useState<string>('personal');
  const [baseDir, setBaseDir] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setProgressStep('forking');
      setForkTarget('personal');
      setError(null);
      return;
    }

    setIsLoading(true);
    Promise.all([
      GithubService.getCurrentUser(),
      GithubService.getUserOrganizations(),
      UserPreferencesService.getPreferences(),
    ])
      .then(([user, orgs, prefs]) => {
        setCurrentUser(user);
        setOrganizations(orgs);
        setBaseDir(prefs.baseDefaultDirectory || null);
      })
      .catch((err) => {
        console.error('[ForkModal] Failed to load:', err);
        setError('Failed to load account information.');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const targetLogin = forkTarget === 'personal' ? (currentUser?.login ?? '') : forkTarget;
  const clonePath = baseDir && targetLogin ? joinPath(baseDir, targetLogin, repoName) : null;

  const handleFork = async () => {
    if (!clonePath) {
      setError('No home folder is configured. Set one in Settings.');
      return;
    }

    setError(null);
    setStep('progress');

    try {
      setProgressStep('forking');
      const forkOptions = forkTarget !== 'personal' ? { organization: forkTarget } : undefined;
      const forkedRepo = await GithubService.forkRepository(repoOwner, repoName, forkOptions);
      if (!forkedRepo) throw new Error('Fork failed — please try again.');

      setProgressStep('cloning');
      const cloneOk = await GitService.cloneRepository(forkedRepo.clone_url, clonePath);
      if (!cloneOk) throw new Error('Clone failed — check your connection and try again.');

      setProgressStep('registering');
      const registered = await registerRepository(forkedRepo.name, clonePath);

      setProgressStep('adding');
      const workspace = await WorkspaceService.getDefaultWorkspace();
      if (workspace) {
        await WorkspaceService.addRepositoryToWorkspace(registered, workspace.id);
      }

      setStep('complete');
      setTimeout(onClose, 2000);
    } catch (err) {
      console.error('[ForkModal]', err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('select');
    }
  };

  if (!isOpen) return null;

  const progressLabels: Record<ProgressStep, string> = {
    forking: 'Forking repository…',
    cloning: 'Cloning fork…',
    registering: 'Registering…',
    adding: 'Adding to workspace…',
  };

  const allProgressSteps: ProgressStep[] = ['forking', 'cloning', 'registering', 'adding'];

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={step === 'progress' ? undefined : onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          width: '560px',
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitFork size={20} style={{ color: theme.colors.text }} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: `${theme.fontSizes[3]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.text,
                }}
              >
                {step === 'complete' ? 'Forked!' : `Fork ${repoOwner}/${repoName}`}
              </h2>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                {step === 'select' ? 'Choose where to fork' : step === 'complete' ? `${targetLogin}/${repoName}` : progressLabels[progressStep]}
              </p>
            </div>
          </div>
          {step !== 'progress' && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: theme.colors.textSecondary, display: 'flex' }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        {step === 'select' && (
          <>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.colors.textSecondary }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span style={{ fontSize: `${theme.fontSizes[1]}px`, fontFamily: theme.fonts.body }}>Loading accounts…</span>
                </div>
              ) : (
                <>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: `${theme.fontSizes[1]}px`,
                        fontWeight: theme.fontWeights.semibold,
                        fontFamily: theme.fonts.body,
                        color: theme.colors.text,
                      }}
                    >
                      Fork to
                    </label>
                    <select
                      value={forkTarget}
                      onChange={(e) => setForkTarget(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: theme.colors.text,
                        fontSize: `${theme.fontSizes[1]}px`,
                        fontFamily: theme.fonts.body,
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="personal">{currentUser?.login ?? 'My account'} (personal)</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.login}>{org.login}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: `${theme.fontSizes[1]}px`,
                        fontWeight: theme.fontWeights.semibold,
                        fontFamily: theme.fonts.body,
                        color: theme.colors.text,
                      }}
                    >
                      Clone to
                    </label>
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: clonePath ? theme.colors.textSecondary : theme.colors.error ?? '#ef4444',
                        fontSize: `${theme.fontSizes[1]}px`,
                        fontFamily: theme.fonts.monospace,
                      }}
                    >
                      {clonePath ?? 'No home folder configured — set one in Settings'}
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: `${theme.colors.error ?? '#ef4444'}20`,
                    color: theme.colors.error ?? '#ef4444',
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontFamily: theme.fonts.body,
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                padding: '16px 20px',
                borderTop: `1px solid ${theme.colors.border}`,
              }}
            >
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: 'transparent',
                  color: theme.colors.text,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleFork()}
                disabled={isLoading || !clonePath}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  cursor: isLoading || !clonePath ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !clonePath ? 0.5 : 1,
                }}
              >
                <GitFork size={16} />
                Fork &amp; Clone
              </button>
            </div>
          </>
        )}

        {(step === 'progress' || step === 'complete') && (
          <div
            style={{
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
            }}
          >
            {step === 'complete' ? (
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: `${theme.colors.success ?? '#22c55e'}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={32} style={{ color: theme.colors.success ?? '#22c55e' }} />
              </div>
            ) : (
              <Loader2 size={48} style={{ color: theme.colors.primary }} className="animate-spin" />
            )}

            <div style={{ textAlign: 'center' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: `${theme.fontSizes[2]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.text,
                }}
              >
                {step === 'complete' ? 'Fork cloned successfully' : progressLabels[progressStep]}
              </h3>
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                {step === 'complete'
                  ? `${targetLogin}/${repoName} is ready`
                  : progressStep === 'forking'
                    ? `Forking ${repoOwner}/${repoName} to ${targetLogin}…`
                    : clonePath}
              </p>
            </div>

            {step === 'progress' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {allProgressSteps.map((s) => {
                  const idx = allProgressSteps.indexOf(s);
                  const currentIdx = allProgressSteps.indexOf(progressStep);
                  return (
                    <div
                      key={s}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: idx <= currentIdx ? theme.colors.primary : theme.colors.border,
                        opacity: idx === currentIdx ? 1 : idx < currentIdx ? 0.6 : 0.3,
                        transition: 'all 0.3s',
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

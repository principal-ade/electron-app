import React, { useState, useEffect } from 'react';
import { useTheme, Theme } from '@principal-ade/industry-theme';
import { Logo } from '@principal-ai/logo-component';
import {
  FolderGit2,
  ArrowRight,
  CheckCircle,
  FolderPlus,
  Folder,
  FolderTree,
  MoveRight,
  AlertCircle,
  Info
} from 'lucide-react';
import { FileSystemService } from '../../main-process-api/FileSystemService';

// Git Logo Component
const GitLogo: React.FC<{ size?: number; color?: string }> = ({
  size = 40,
  color = '#F05032'
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 92 92"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M90.156 41.965L50.036 1.848a5.918 5.918 0 0 0-8.372 0l-8.328 8.332 10.566 10.566a7.03 7.03 0 0 1 7.23 1.684 7.043 7.043 0 0 1 1.673 7.277l10.183 10.184a7.026 7.026 0 0 1 7.278 1.672 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.038 7.038 0 0 1-1.532-7.66l-9.5-9.497V59.36a7.04 7.04 0 0 1 1.86 11.29 7.04 7.04 0 0 1-9.957 0 7.04 7.04 0 0 1 0-9.958 7.034 7.034 0 0 1 2.308-1.539V33.926a7.001 7.001 0 0 1-2.308-1.535 7.049 7.049 0 0 1-1.516-7.7L29.242 14.273 1.734 41.777a5.918 5.918 0 0 0 0 8.371l40.12 40.118a5.918 5.918 0 0 0 8.371 0l39.931-39.934a5.925 5.925 0 0 0 0-8.367"
      fill={color}
    />
  </svg>
);

// GitHub Logo Component (Octocat mark)
const GitHubLogo: React.FC<{ size?: number; color?: string }> = ({
  size = 40,
  color = '#24292e'
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 98 96"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      fill={color}
    />
  </svg>
);

type OnboardingStep = 'welcome' | 'choose-method' | 'folder-selection' | 'scanning' | 'repo-location' | 'home-directory' | 'organize-projects' | 'github-connect' | 'ready';

type RepoLocationMode = 'single' | 'multiple' | 'add-list';
type SetupMethod = 'scan' | 'select' | null;

interface OnboardingWizardProps {
  repoLocationMode?: RepoLocationMode;
  onComplete?: (data: OnboardingData) => void;
  // Service methods for testing/mocking
  fileSystemService?: {
    getTopLevelFolders: () => Promise<TopLevelFolder[]>;
    scanFoldersForRepos: (folderPaths: string[]) => Promise<{ success: boolean; repos: Array<{ path: string; name: string; owner?: string; registered?: boolean; alreadyRegistered?: boolean; registrationError?: string }>; error?: string }>;
    onRepoScanProgress: (callback: (progress: { current: number; total: number; currentFolder: string; foundRepos: number }) => void) => () => void;
    selectDirectory: (options?: { title?: string; buttonLabel?: string; properties?: Array<'openDirectory' | 'createDirectory' | 'promptToCreate'> }) => Promise<{ filePaths: string[]; canceled: boolean } | { canceled: true } | null>;
  };
}

interface OnboardingData {
  repoPaths: string[];
  hasMultipleLocations: boolean;
  githubConnected: boolean;
}

interface TopLevelFolder {
  name: string;
  path: string;
  selected: boolean;
  category: 'dev' | 'common' | 'system';
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  repoLocationMode = 'single',
  onComplete,
  fileSystemService = FileSystemService
}) => {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [setupMethod, setSetupMethod] = useState<SetupMethod>(null);
  const [repoPaths, setRepoPaths] = useState<string[]>([]);
  const [topLevelFolders, setTopLevelFolders] = useState<TopLevelFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [foundProjects, setFoundProjects] = useState<Array<{ currentPath: string; owner: string; name: string; registered?: boolean; alreadyRegistered?: boolean; registrationError?: string }>>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, currentFolder: '', foundRepos: 0 });
  const [githubConnected, setGithubConnected] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [devDirectoryName, setDevDirectoryName] = useState('Development');
  const [shouldOrganize, setShouldOrganize] = useState(true);

  // Get active steps based on user's choice
  const getActiveSteps = (): OnboardingStep[] => {
    const baseSteps: OnboardingStep[] = ['welcome', 'choose-method'];

    if (setupMethod === 'scan') {
      return [...baseSteps, 'folder-selection', 'scanning', 'home-directory', 'organize-projects', 'github-connect', 'ready'];
    } else if (setupMethod === 'select') {
      return [...baseSteps, 'repo-location', 'home-directory', 'organize-projects', 'github-connect', 'ready'];
    }

    // Before method is chosen, show all possible steps
    return ['welcome', 'choose-method', 'home-directory', 'organize-projects', 'github-connect', 'ready'];
  };

  const activeSteps = getActiveSteps();
  const currentStepIndex = activeSteps.indexOf(currentStep);

  // Don't count welcome step in progress
  const actualSteps: Array<Exclude<OnboardingStep, 'welcome'>> = activeSteps.filter((s): s is Exclude<OnboardingStep, 'welcome'> => s !== 'welcome');
  const actualStepIndex = currentStep === 'welcome' ? -1 : actualSteps.indexOf(currentStep as Exclude<OnboardingStep, 'welcome'>);
  const progress = currentStep === 'welcome' ? 0 : ((actualStepIndex + 1) / actualSteps.length) * 100;

  // Load top-level folders when entering folder-selection step
  useEffect(() => {
    if (currentStep === 'folder-selection' && topLevelFolders.length === 0) {
      setIsLoadingFolders(true);
      fileSystemService.getTopLevelFolders().then((folders) => {
        setTopLevelFolders(folders.map(f => ({
          ...f,
          selected: f.category === 'dev' // Pre-select dev folders
        })));
        setIsLoadingFolders(false);
      });
    }
  }, [currentStep, topLevelFolders.length, fileSystemService]);

  // Set up progress listener when entering scanning step
  useEffect(() => {
    if (currentStep === 'scanning') {
      const cleanup = fileSystemService.onRepoScanProgress((progress) => {
        setScanProgress(progress);
      });

      // Start scanning
      startScanning();

      return cleanup;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, fileSystemService]);

  const startScanning = async () => {
    setIsScanning(true);
    setFoundProjects([]);
    setScanProgress({ current: 0, total: 0, currentFolder: '', foundRepos: 0 });

    try {
      const selectedFolders = topLevelFolders.filter(f => f.selected).map(f => f.path);

      const result = await fileSystemService.scanFoldersForRepos(selectedFolders);

      if (result.success && result.repos) {
        // Convert to the format expected by foundProjects
        const projects = result.repos.map(repo => ({
          currentPath: repo.path,
          owner: repo.owner || 'local', // Fallback for repos without remotes
          name: repo.name,
          registered: repo.registered,
          alreadyRegistered: repo.alreadyRegistered,
          registrationError: repo.registrationError
        }));
        setFoundProjects(projects);
      }
    } catch (error) {
      console.error('Scanning failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleStart = () => {
    setShowContent(false);

    // Step 1: Fade out welcome content (300ms)
    setTimeout(() => {
      setCurrentStep('choose-method');
      setHasStarted(true);

      // Step 2: Nav slides up (400ms animation in CSS)
      // Step 3: Show new content after nav appears
      setTimeout(() => {
        setShowContent(true);
      }, 400);
    }, 300);
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeSteps.length) {
      setShowContent(false);
      setTimeout(() => {
        setCurrentStep(activeSteps[nextIndex]);
        setTimeout(() => {
          setShowContent(true);
        }, 50);
      }, 300);
    } else {
      onComplete?.({
        repoPaths,
        hasMultipleLocations: false,
        githubConnected
      });
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      if (activeSteps[prevIndex] === 'welcome') {
        // Going back to welcome - reverse the animation
        setShowContent(false);
        setTimeout(() => {
          setHasStarted(false);
          setCurrentStep('welcome');
          setTimeout(() => {
            setShowContent(true);
          }, 100);
        }, 300);
      } else {
        // Normal back transition with fade
        setShowContent(false);
        setTimeout(() => {
          setCurrentStep(activeSteps[prevIndex]);
          setTimeout(() => {
            setShowContent(true);
          }, 50);
        }, 300);
      }
    }
  };

  const handleAddPath = async () => {
    const result = await fileSystemService.selectDirectory({
      title: 'Select Git Projects Folder',
      buttonLabel: 'Select Folder',
      properties: ['openDirectory'],
    });

    if (!result || result.canceled || !result.filePaths?.[0]) {
      return;
    }

    const selectedPath = result.filePaths[0];

    // For single mode, replace the path; for add-list mode, add to the list
    if (repoLocationMode === 'single') {
      setRepoPaths([selectedPath]);
    } else {
      // Don't add duplicates
      if (!repoPaths.includes(selectedPath)) {
        setRepoPaths([...repoPaths, selectedPath]);
      }
    }
  };

  const handleRemovePath = (index: number) => {
    setRepoPaths(repoPaths.filter((_, i) => i !== index));
  };

  const canProceed = () => {
    if (currentStep === 'choose-method') {
      return setupMethod !== null;
    }
    if (currentStep === 'folder-selection') {
      return topLevelFolders.some(f => f.selected);
    }
    if (currentStep === 'scanning') {
      return !isScanning && foundProjects.length > 0;
    }
    if (currentStep === 'repo-location') {
      return repoPaths.length > 0;
    }
    return true;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Progress Bar */}
      <div style={{
        height: 4,
        backgroundColor: theme.colors.border,
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${progress}%`,
          backgroundColor: theme.colors.primary,
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px'
      }}>
        <div style={{
          maxWidth: 600,
          width: '100%',
          opacity: showContent ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}>
          {currentStep === 'welcome' && (
            <WelcomeStep theme={theme} onStart={handleStart} />
          )}

          {currentStep === 'choose-method' && (
            <ChooseMethodStep
              theme={theme}
              selectedMethod={setupMethod}
              onSelectMethod={setSetupMethod}
            />
          )}

          {currentStep === 'folder-selection' && (
            <FolderSelectionStep
              theme={theme}
              folders={topLevelFolders}
              isLoading={isLoadingFolders}
              onToggleFolder={(name) => {
                setTopLevelFolders(folders =>
                  folders.map(f => f.name === name ? { ...f, selected: !f.selected } : f)
                );
              }}
            />
          )}

          {currentStep === 'scanning' && (
            <ScanningStep
              theme={theme}
              isScanning={isScanning}
              progress={scanProgress}
              foundProjects={foundProjects}
            />
          )}

          {currentStep === 'repo-location' && (
            <RepoLocationStep
              theme={theme}
              mode={repoLocationMode}
              paths={repoPaths}
              onAddPath={handleAddPath}
              onRemovePath={handleRemovePath}
            />
          )}

          {currentStep === 'home-directory' && (
            <HomeDirectoryStep
              theme={theme}
              devDirectoryName={devDirectoryName}
              onSetDevDirectoryName={setDevDirectoryName}
            />
          )}

          {currentStep === 'organize-projects' && (
            <OrganizeProjectsStep
              theme={theme}
              projects={foundProjects}
              devDirectoryName={devDirectoryName}
              shouldOrganize={shouldOrganize}
              onToggleOrganize={() => setShouldOrganize(!shouldOrganize)}
            />
          )}

          {currentStep === 'github-connect' && (
            <GitHubConnectStep
              theme={theme}
              isConnected={githubConnected}
              onConnect={() => setGithubConnected(true)}
            />
          )}

          {currentStep === 'ready' && (
            <ReadyStep theme={theme} />
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      {hasStarted && (
      <div style={{
        padding: '24px',
        borderTop: `1px solid ${theme.colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        animation: 'slideUpFromBottom 0.4s ease-out',
      }}>
        <button
          onClick={handleBack}
          style={{
            width: 140,
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: 500,
            transition: 'all 0.2s ease'
          }}
        >
          Back
        </button>

        <div style={{
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[0]}px`,
        }}>
          Step {actualStepIndex + 1} of {actualSteps.length}
        </div>

        <button
          onClick={handleNext}
          disabled={!canProceed()}
          style={{
            width: 140,
            padding: '12px 24px',
            backgroundColor: canProceed() ? theme.colors.primary : theme.colors.border,
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            cursor: canProceed() ? 'pointer' : 'not-allowed',
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: 500,
            transition: 'all 0.2s ease'
          }}
        >
          {currentStep === 'ready' ? 'Finish' : currentStep === 'github-connect' && !githubConnected ? 'Skip' : 'Continue'}
        </button>
      </div>
      )}
    </div>
  );
};

// Step Components

interface ChooseMethodStepProps {
  theme: Theme;
  selectedMethod: SetupMethod;
  onSelectMethod: (method: SetupMethod) => void;
}

const ChooseMethodStep: React.FC<ChooseMethodStepProps> = ({
  theme,
  selectedMethod,
  onSelectMethod
}) => (
  <div>
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 24
    }}>
      <div style={{
        display: 'inline-flex',
        padding: 24,
        backgroundColor: '#ffffff',
        borderRadius: '50%'
      }}>
        <GitLogo size={60} color="#F05032" />
      </div>
    </div>

    <h2 style={{
      fontFamily: theme.fonts.heading,
      fontSize: `${theme.fontSizes[4]}px`,
      fontWeight: 700,
      color: theme.colors.text,
      marginBottom: 32,
      textAlign: 'center'
    }}>
      How would you like to find your <span style={{ color: '#F05032' }}>git</span> projects?
    </h2>

    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }}>
      {/* Scan Option */}
      <button
        onClick={() => onSelectMethod('scan')}
        style={{
          padding: 24,
          backgroundColor: selectedMethod === 'scan' ? `${theme.colors.primary}15` : theme.colors.backgroundSecondary,
          border: `2px solid ${selectedMethod === 'scan' ? theme.colors.primary : theme.colors.border}`,
          borderRadius: 12,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16
        }}>
          <div style={{
            padding: 12,
            backgroundColor: `${theme.colors.primary}20`,
            borderRadius: 8,
            flexShrink: 0
          }}>
            <FolderTree size={24} color={theme.colors.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: 8
            }}>
              Find for me
            </div>
            <div style={{
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.5
            }}>
              We will look for .git which are present in git projects
            </div>
          </div>
          {selectedMethod === 'scan' && (
            <CheckCircle size={24} color={theme.colors.primary} />
          )}
        </div>
      </button>

      {/* Select Option */}
      <button
        onClick={() => onSelectMethod('select')}
        style={{
          padding: 24,
          backgroundColor: selectedMethod === 'select' ? `${theme.colors.primary}15` : theme.colors.backgroundSecondary,
          border: `2px solid ${selectedMethod === 'select' ? theme.colors.primary : theme.colors.border}`,
          borderRadius: 12,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16
        }}>
          <div style={{
            padding: 12,
            backgroundColor: `${theme.colors.primary}20`,
            borderRadius: 8,
            flexShrink: 0
          }}>
            <FolderPlus size={24} color={theme.colors.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: 8
            }}>
              I'll pick
            </div>
            <div style={{
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.5
            }}>
              Use Finder to pick git projects manually
            </div>
          </div>
          {selectedMethod === 'select' && (
            <CheckCircle size={24} color={theme.colors.primary} />
          )}
        </div>
      </button>
    </div>
  </div>
);

interface WelcomeStepProps {
  theme: Theme;
  onStart: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ theme, onStart }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 32
    }}>
      <Logo width={120} height={120} color={theme.colors.primary} particleColor={theme.colors.text} />
    </div>

    <h1 style={{
      fontFamily: theme.fonts.heading,
      fontSize: `${theme.fontSizes[5]}px`,
      fontWeight: 700,
      color: theme.colors.text,
      marginBottom: 16
    }}>
      Welcome to Principal <span style={{ color: theme.colors.primary }}>AI</span>
    </h1>

    <p style={{
      fontFamily: theme.fonts.body,
      fontSize: `${theme.fontSizes[2]}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.6,
      marginBottom: 48
    }}>
      Let's get you set up in just a few quick steps.
    </p>

    <button
      onClick={onStart}
      style={{
        padding: '16px 48px',
        backgroundColor: theme.colors.primary,
        color: '#ffffff',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[2]}px`,
        fontWeight: 600,
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      Start
    </button>
  </div>
);

interface RepoLocationStepProps {
  theme: Theme;
  mode: RepoLocationMode;
  paths: string[];
  onAddPath: () => void;
  onRemovePath: (index: number) => void;
}

const RepoLocationStep: React.FC<RepoLocationStepProps> = ({
  theme,
  mode,
  paths,
  onAddPath,
  onRemovePath
}) => (
  <div>
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 24
    }}>
      <div style={{
        display: 'inline-flex',
        padding: 24,
        backgroundColor: '#ffffff',
        borderRadius: '50%'
      }}>
        <GitLogo size={60} color="#F05032" />
      </div>
    </div>

    <h2 style={{
      fontFamily: theme.fonts.heading,
      fontSize: `${theme.fontSizes[4]}px`,
      fontWeight: 700,
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: 'center'
    }}>
      Where do you keep your <span style={{ color: '#F05032' }}>git</span> projects?
    </h2>

    <p style={{
      fontFamily: theme.fonts.body,
      fontSize: `${theme.fontSizes[1]}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.6,
      marginBottom: 32,
      textAlign: 'center'
    }}>
      This will help us find your projects to make it easier for you to manage them.
    </p>

    {mode === 'single' && (
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={onAddPath}
          style={{
            width: '100%',
            padding: '48px 24px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `2px dashed ${theme.colors.border}`,
            borderRadius: 12,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            transition: 'all 0.2s ease'
          }}
        >
          <Folder size={32} color={theme.colors.textSecondary} />
          <span style={{
            fontFamily: theme.fonts.body,
            color: theme.colors.text,
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: 500
          }}>
            {paths.length > 0 ? paths[0] : 'Choose main folder'}
          </span>
        </button>
      </div>
    )}

    {mode === 'add-list' && (
      <div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 16
        }}>
          {paths.map((path) => (
            <div
              key={path}
              style={{
                padding: '16px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <Folder size={20} color={theme.colors.textSecondary} />
                <span style={{
                  fontFamily: theme.fonts.body,
                  color: theme.colors.text,
                  fontSize: `${theme.fontSizes[1]}px`
                }}>
                  {path}
                </span>
              </div>
              <button
                onClick={() => onRemovePath(paths.indexOf(path))}
                style={{
                  padding: '4px 12px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: theme.fonts.body,
                  fontSize: `${theme.fontSizes[0]}px`,
                  transition: 'color 0.2s ease'
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onAddPath}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: 'transparent',
            color: theme.colors.primary,
            border: `2px dashed ${theme.colors.primary}`,
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s ease'
          }}
        >
          <FolderPlus size={20} />
          Add another folder
        </button>
      </div>
    )}
  </div>
);

interface FolderSelectionStepProps {
  theme: Theme;
  folders: TopLevelFolder[];
  isLoading: boolean;
  onToggleFolder: (name: string) => void;
}

const FolderSelectionStep: React.FC<FolderSelectionStepProps> = ({
  theme,
  folders,
  isLoading,
  onToggleFolder
}) => {
  const selectedCount = folders.filter(f => f.selected).length;

  // Skeleton loader items
  const skeletonItems = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <div style={{
          display: 'inline-flex',
          padding: 20,
          backgroundColor: `${theme.colors.primary}15`,
          borderRadius: '50%'
        }}>
          <FolderTree size={40} color={theme.colors.primary} />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[4]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center'
      }}>
        Choose folders to scan
      </h2>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[1]}px`,
        color: theme.colors.textSecondary,
        lineHeight: 1.6,
        marginBottom: 8,
        textAlign: 'center'
      }}>
        Select which folders to search for <span style={{ color: '#F05032' }}>git</span> projects
      </p>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[0]}px`,
        color: theme.colors.textSecondary,
        marginBottom: 32,
        textAlign: 'center'
      }}>
        {selectedCount} folder{selectedCount !== 1 ? 's' : ''} selected
      </p>

      <div style={{
        maxHeight: 400,
        minHeight: 400,
        overflowY: 'auto',
        marginBottom: 24
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {isLoading ? (
            // Skeleton loaders
            skeletonItems.map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 8,
                  height: 48
                }}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  backgroundColor: theme.colors.border,
                  borderRadius: 3,
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <div style={{
                  width: 20,
                  height: 20,
                  backgroundColor: theme.colors.border,
                  borderRadius: 4,
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <div style={{
                  flex: 1,
                  height: 16,
                  backgroundColor: theme.colors.border,
                  borderRadius: 4,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  maxWidth: `${40 + Math.random() * 30}%`
                }} />
              </div>
            ))
          ) : (
            // Actual folders
            folders.map((folder) => {
              const isDev = folder.category === 'dev';
              const isSystem = folder.category === 'system';

              return (
                <label
                  key={folder.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    backgroundColor: folder.selected ? `${theme.colors.primary}10` : theme.colors.backgroundSecondary,
                    border: `1px solid ${folder.selected ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: isSystem ? 0.6 : 1
                  }}
                >
                  <input
                    type="checkbox"
                    checked={folder.selected}
                    onChange={() => onToggleFolder(folder.name)}
                    style={{
                      width: 18,
                      height: 18,
                      cursor: 'pointer'
                    }}
                  />
                  <Folder
                    size={20}
                    color={isDev ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <span style={{
                    flex: 1,
                    fontFamily: theme.fonts.monospace,
                    fontSize: `${theme.fontSizes[1]}px`,
                    color: theme.colors.text,
                    fontWeight: isDev ? 600 : 400
                  }}>
                    ~/{folder.name}
                  </span>
                  {isDev && (
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: `${theme.colors.primary}20`,
                      color: theme.colors.primary,
                      borderRadius: 4,
                      fontSize: `${theme.fontSizes[0]}px`,
                      fontWeight: 500
                    }}>
                      Recommended
                    </span>
                  )}
                  {isSystem && (
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: `${theme.colors.textSecondary}20`,
                      color: theme.colors.textSecondary,
                      borderRadius: 4,
                      fontSize: `${theme.fontSizes[0]}px`
                    }}>
                      Excluded
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

interface ScanningStepProps {
  theme: Theme;
  isScanning: boolean;
  progress: { current: number; total: number; currentFolder: string };
  foundProjects: Array<{ currentPath: string; owner: string; name: string; registered?: boolean; alreadyRegistered?: boolean; registrationError?: string }>;
}

const ScanningStep: React.FC<ScanningStepProps> = ({
  theme,
  isScanning,
  progress,
  foundProjects
}) => {
  // Skeleton loader items for projects
  const skeletonProjects = Array.from({ length: 5 }, (_, i) => i);

  // Calculate progress percentage
  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const circumference = 2 * Math.PI * 45; // radius of 45px
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 24,
        position: 'relative'
      }}>
        {/* Circular progress indicator - always visible */}
        <svg
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            width: 110,
            height: 110
          }}
        >
          {/* Background circle */}
          <circle
            cx="55"
            cy="55"
            r="45"
            stroke={theme.colors.border}
            strokeWidth="3"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="55"
            cy="55"
            r="45"
            stroke={!isScanning && foundProjects.length > 0 ? theme.colors.success || '#10b981' : theme.colors.primary}
            strokeWidth="3"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={isScanning ? strokeDashoffset : 0}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease'
            }}
          />
        </svg>

        <div style={{
          display: 'inline-flex',
          padding: 20,
          backgroundColor: `${theme.colors.primary}15`,
          borderRadius: '50%',
          zIndex: 1
        }}>
          <FolderGit2 size={40} color={theme.colors.primary} />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[4]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center'
      }}>
        {isScanning ? (
          <>
            Scanning for <span style={{ color: '#F05032' }}>git</span> projects...
          </>
        ) : (
          'Scan complete!'
        )}
      </h2>

      {/* Results area - always reserve space */}
      <div style={{
        minHeight: 300
      }}>
        {isScanning && (
          <>
            <p style={{
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.6,
              marginBottom: 24,
              textAlign: 'center',
              minHeight: 24
            }}>
              {progress.currentFolder ? `Scanning ~/${progress.currentFolder}...` : 'Starting scan...'}
            </p>

            <div style={{
              maxHeight: 300,
              overflowY: 'auto',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: 8,
              padding: 16
            }}>
              {skeletonProjects.map((i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderBottom: i < skeletonProjects.length - 1 ? `1px solid ${theme.colors.border}` : 'none'
                  }}
                >
                  <div style={{
                    width: 20,
                    height: 20,
                    backgroundColor: theme.colors.border,
                    borderRadius: 4,
                    animation: 'pulse 1.5s ease-in-out infinite'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      height: 16,
                      backgroundColor: theme.colors.border,
                      borderRadius: 4,
                      marginBottom: 8,
                      animation: 'pulse 1.5s ease-in-out infinite',
                      maxWidth: `${30 + Math.random() * 30}%`
                    }} />
                    <div style={{
                      height: 12,
                      backgroundColor: theme.colors.border,
                      borderRadius: 4,
                      animation: 'pulse 1.5s ease-in-out infinite',
                      maxWidth: `${50 + Math.random() * 30}%`
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!isScanning && foundProjects.length === 0 && (
          <p style={{
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
            marginBottom: 24,
            textAlign: 'center'
          }}>
            No <span style={{ color: '#F05032' }}>git</span> projects found in the selected folders
          </p>
        )}

        {!isScanning && foundProjects.length > 0 && (
          <>
            <p style={{
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.6,
              marginBottom: 24,
              textAlign: 'center'
            }}>
              Found {foundProjects.length} <span style={{ color: '#F05032' }}>git</span> {foundProjects.length === 1 ? 'project' : 'projects'}
              {foundProjects.some(p => p.registered === true || p.registered === false) && (
                <>
                  {' • '}
                  <span style={{ color: theme.colors.success || '#10b981' }}>
                    {foundProjects.filter(p => p.registered === true && !p.alreadyRegistered).length} newly registered
                  </span>
                  {foundProjects.some(p => p.alreadyRegistered) && (
                    <>
                      {' • '}
                      <span style={{ color: theme.colors.textSecondary }}>
                        {foundProjects.filter(p => p.alreadyRegistered).length} already in library
                      </span>
                    </>
                  )}
                  {foundProjects.some(p => p.registered === false) && (
                    <>
                      {' • '}
                      <span style={{ color: theme.colors.error || '#ef4444' }}>
                        {foundProjects.filter(p => p.registered === false).length} failed
                      </span>
                    </>
                  )}
                </>
              )}
            </p>

            <div style={{
              maxHeight: 300,
              overflowY: 'auto',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: 8,
              padding: 16
            }}>
              {foundProjects.map((project, idx) => (
                <div
                  key={project.currentPath}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderBottom: idx < foundProjects.length - 1 ? `1px solid ${theme.colors.border}` : 'none'
                  }}
                >
                  <FolderGit2 size={20} color={theme.colors.primary} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: theme.fonts.monospace,
                      fontSize: `${theme.fontSizes[1]}px`,
                      color: theme.colors.text,
                      fontWeight: 500
                    }}>
                      {project.name}
                    </div>
                    <div style={{
                      fontFamily: theme.fonts.monospace,
                      fontSize: `${theme.fontSizes[0]}px`,
                      color: theme.colors.textSecondary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {project.currentPath}
                    </div>
                    {project.alreadyRegistered && (
                      <div style={{
                        fontFamily: theme.fonts.body,
                        fontSize: `${theme.fontSizes[0]}px`,
                        color: theme.colors.textSecondary,
                        marginTop: 4
                      }}>
                        Already in library
                      </div>
                    )}
                    {project.registrationError && (
                      <div style={{
                        fontFamily: theme.fonts.body,
                        fontSize: `${theme.fontSizes[0]}px`,
                        color: theme.colors.error || '#ef4444',
                        marginTop: 4
                      }}>
                        Failed: {project.registrationError}
                      </div>
                    )}
                  </div>
                  {project.registered === true && !project.alreadyRegistered && (
                    <CheckCircle size={20} color={theme.colors.success || '#10b981'} />
                  )}
                  {project.alreadyRegistered && (
                    <Info size={20} color={theme.colors.textSecondary} />
                  )}
                  {project.registered === false && (
                    <AlertCircle size={20} color={theme.colors.error || '#ef4444'} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface HomeDirectoryStepProps {
  theme: Theme;
  devDirectoryName: string;
  onSetDevDirectoryName: (name: string) => void;
}

const HomeDirectoryStep: React.FC<HomeDirectoryStepProps> = ({
  theme,
  devDirectoryName,
  onSetDevDirectoryName
}) => {
  const suggestions = ['Development', 'Developer', 'Code', 'Projects'];

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <div style={{
          display: 'inline-flex',
          padding: 20,
          backgroundColor: `${theme.colors.primary}15`,
          borderRadius: '50%'
        }}>
          <FolderTree size={40} color={theme.colors.primary} />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[4]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center'
      }}>
        Set a Development directory
      </h2>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[1]}px`,
        color: theme.colors.textSecondary,
        lineHeight: 1.6,
        marginBottom: 32,
        textAlign: 'center'
      }}>
        This is where we will place all future <span style={{ color: '#F05032' }}>git</span> projects in owner/reponame style.
      </p>

      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: 'block',
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[0]}px`,
          color: theme.colors.textSecondary,
          marginBottom: 8
        }}>
          Directory name
        </label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 8
        }}>
          <span style={{
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            color: theme.colors.textSecondary
          }}>
            ~/
          </span>
          <input
            type="text"
            value={devDirectoryName}
            onChange={(e) => onSetDevDirectoryName(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.text
            }}
            placeholder="Development"
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[0]}px`,
          color: theme.colors.textSecondary,
          marginBottom: 12
        }}>
          Suggestions:
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap'
        }}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSetDevDirectoryName(suggestion)}
              style={{
                padding: '8px 16px',
                backgroundColor: devDirectoryName === suggestion ? `${theme.colors.primary}20` : theme.colors.backgroundSecondary,
                color: devDirectoryName === suggestion ? theme.colors.primary : theme.colors.text,
                border: `1px solid ${devDirectoryName === suggestion ? theme.colors.primary : theme.colors.border}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: theme.fonts.body,
                fontSize: `${theme.fontSizes[0]}px`,
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface OrganizeProjectsStepProps {
  theme: Theme;
  projects: Array<{ currentPath: string; owner: string; name: string; registered?: boolean; alreadyRegistered?: boolean; registrationError?: string }>;
  devDirectoryName: string;
  shouldOrganize: boolean;
  onToggleOrganize: () => void;
}

const OrganizeProjectsStep: React.FC<OrganizeProjectsStepProps> = ({
  theme,
  projects,
  devDirectoryName,
  shouldOrganize,
  onToggleOrganize
}) => {
  const homeDir = '~';

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <div style={{
          display: 'inline-flex',
          padding: 20,
          backgroundColor: `${theme.colors.primary}15`,
          borderRadius: '50%'
        }}>
          <FolderTree size={40} color={theme.colors.primary} />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[4]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center'
      }}>
        Organize your projects?
      </h2>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[1]}px`,
        color: theme.colors.textSecondary,
        lineHeight: 1.6,
        marginBottom: 32,
        textAlign: 'center'
      }}>
        We found {projects.length} git {projects.length === 1 ? 'project' : 'projects'}. Would you like us to organize them?
      </p>

      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        padding: 16,
        borderRadius: 8,
        backgroundColor: shouldOrganize ? `${theme.colors.primary}10` : 'transparent',
        border: `1px solid ${shouldOrganize ? theme.colors.primary : theme.colors.border}`,
        transition: 'all 0.2s ease',
        marginBottom: 24
      }}>
        <input
          type="checkbox"
          checked={shouldOrganize}
          onChange={onToggleOrganize}
          style={{
            width: 20,
            height: 20,
            cursor: 'pointer'
          }}
        />
        <span style={{
          fontFamily: theme.fonts.body,
          color: theme.colors.text,
          fontSize: `${theme.fontSizes[1]}px`
        }}>
          Yes, organize my projects into {devDirectoryName}
        </span>
      </label>

      <div style={{
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: 8,
        padding: 16,
        maxHeight: 300,
        overflowY: 'auto'
      }}>
          <div style={{
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[2]}px`,
            color: theme.colors.textSecondary,
            marginBottom: 16,
            fontWeight: 600
          }}>
            {shouldOrganize ? 'Preview:' : 'Discovered projects:'}
          </div>
          {projects.map((project, idx) => (
            <div
              key={project.currentPath}
              style={{
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: idx < projects.length - 1 ? `1px solid ${theme.colors.border}` : 'none'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8
              }}>
                <FolderGit2 size={20} color={theme.colors.textSecondary} />
                <span style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: `${theme.fontSizes[2]}px`,
                  color: theme.colors.text,
                  fontWeight: 500
                }}>
                  {project.name}
                </span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 40px auto',
                alignItems: 'center',
                gap: 8,
                paddingLeft: 28
              }}>
                <div style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: `${theme.fontSizes[1]}px`,
                  color: theme.colors.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {project.currentPath}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  opacity: shouldOrganize ? 1 : 0,
                  visibility: shouldOrganize ? 'visible' : 'hidden'
                }}>
                  <MoveRight size={20} color={theme.colors.primary} />
                </div>
                <div style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: `${theme.fontSizes[1]}px`,
                  color: theme.colors.primary,
                  fontWeight: 500,
                  opacity: shouldOrganize ? 1 : 0,
                  visibility: shouldOrganize ? 'visible' : 'hidden'
                }}>
                  {homeDir}/{devDirectoryName}/{project.owner}/{project.name}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

interface GitHubConnectStepProps {
  theme: Theme;
  isConnected: boolean;
  onConnect: () => void;
}

const GitHubConnectStep: React.FC<GitHubConnectStepProps> = ({
  theme,
  isConnected,
  onConnect
}) => (
  <div>
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      marginBottom: 24
    }}>
      <Logo width={80} height={80} color={theme.colors.primary} particleColor={theme.colors.text} />
      <ArrowRight size={32} color={theme.colors.textSecondary} />
      <div style={{
        display: 'inline-flex',
        padding: 10,
        backgroundColor: '#24292e',
        borderRadius: '50%'
      }}>
        <GitHubLogo size={60} color="#ffffff" />
      </div>
    </div>

    <h2 style={{
      fontFamily: theme.fonts.heading,
      fontSize: `${theme.fontSizes[4]}px`,
      fontWeight: 700,
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: 'center'
    }}>
      Connect to GitHub?
    </h2>

    <p style={{
      fontFamily: theme.fonts.body,
      fontSize: `${theme.fontSizes[1]}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.6,
      marginBottom: 32,
      textAlign: 'center'
    }}>
      GitHub connectivity is needed to use the social features.
    </p>

    {!isConnected ? (
      <button
        onClick={onConnect}
        style={{
          width: '100%',
          padding: '16px 24px',
          backgroundColor: '#24292e',
          color: '#ffffff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[1]}px`,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          transition: 'all 0.2s ease'
        }}
      >
        <GitHubLogo size={20} color="#ffffff" />
        Connect with GitHub
      </button>
    ) : (
      <div style={{
        padding: 24,
        backgroundColor: `${theme.colors.success || '#10b981'}15`,
        border: `1px solid ${theme.colors.success || '#10b981'}`,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }}>
        <CheckCircle size={32} color={theme.colors.success || '#10b981'} />
        <div>
          <div style={{
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: 4
          }}>
            Connected successfully!
          </div>
          <div style={{
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[0]}px`,
            color: theme.colors.textSecondary
          }}>
            You're all set to access GitHub features
          </div>
        </div>
      </div>
    )}
  </div>
);

interface ReadyStepProps {
  theme: Theme;
}

const ReadyStep: React.FC<ReadyStepProps> = ({ theme }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      display: 'inline-flex',
      padding: 32,
      backgroundColor: `${theme.colors.success || '#10b981'}15`,
      borderRadius: '50%',
      marginBottom: 24
    }}>
      <CheckCircle size={64} color={theme.colors.success || '#10b981'} />
    </div>

    <h1 style={{
      fontFamily: theme.fonts.heading,
      fontSize: `${theme.fontSizes[5]}px`,
      fontWeight: 700,
      color: theme.colors.text,
      marginBottom: 16
    }}>
      You're all set!
    </h1>

    <p style={{
      fontFamily: theme.fonts.body,
      fontSize: `${theme.fontSizes[2]}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.6
    }}>
      Let's start exploring your <span style={{ color: '#F05032' }}>git</span> projects and building something awesome together.
    </p>
  </div>
);

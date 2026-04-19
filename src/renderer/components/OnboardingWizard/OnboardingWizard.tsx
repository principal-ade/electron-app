import React, { useState } from 'react';
import { useTheme, Theme } from '@principal-ade/industry-theme';
import { Logo } from '@principal-ai/logo-component';
import {
  FolderGit2,
  Github,
  ArrowRight,
  CheckCircle,
  FolderPlus,
  Folder,
  FolderTree,
  MoveRight
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

type OnboardingStep = 'welcome' | 'repo-location' | 'home-directory' | 'organize-projects' | 'github-connect' | 'ready';

type RepoLocationMode = 'single' | 'multiple' | 'add-list';

interface OnboardingWizardProps {
  repoLocationMode?: RepoLocationMode;
  onComplete?: (data: OnboardingData) => void;
}

interface OnboardingData {
  repoPaths: string[];
  hasMultipleLocations: boolean;
  githubConnected: boolean;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  repoLocationMode = 'single',
  onComplete
}) => {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [repoPaths, setRepoPaths] = useState<string[]>([]);
  const [githubConnected, setGithubConnected] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [devDirectoryName, setDevDirectoryName] = useState('Development');
  const [shouldOrganize, setShouldOrganize] = useState(true);

  // Mock found projects - in real implementation, this would come from scanning the paths
  const foundProjects = [
    { currentPath: '/Users/developer/my-app', owner: 'johndoe', name: 'my-app' },
    { currentPath: '/Users/developer/projects/react-project', owner: 'acme', name: 'react-project' },
    { currentPath: '/Users/developer/Downloads/old-repo', owner: 'janedoe', name: 'old-repo' }
  ];

  const steps: OnboardingStep[] = ['welcome', 'repo-location', 'home-directory', 'organize-projects', 'github-connect', 'ready'];
  const currentStepIndex = steps.indexOf(currentStep);

  // Don't count welcome step in progress
  const actualSteps: Array<Exclude<OnboardingStep, 'welcome'>> = steps.filter((s): s is Exclude<OnboardingStep, 'welcome'> => s !== 'welcome');
  const actualStepIndex = currentStep === 'welcome' ? -1 : actualSteps.indexOf(currentStep as Exclude<OnboardingStep, 'welcome'>);
  const progress = currentStep === 'welcome' ? 0 : ((actualStepIndex + 1) / actualSteps.length) * 100;

  const handleStart = () => {
    setShowContent(false);

    // Step 1: Fade out welcome content (300ms)
    setTimeout(() => {
      setCurrentStep('repo-location');
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
    if (nextIndex < steps.length) {
      setShowContent(false);
      setTimeout(() => {
        setCurrentStep(steps[nextIndex]);
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
      if (steps[prevIndex] === 'welcome') {
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
          setCurrentStep(steps[prevIndex]);
          setTimeout(() => {
            setShowContent(true);
          }, 50);
        }, 300);
      }
    }
  };

  const handleAddPath = async () => {
    const result = await FileSystemService.selectDirectory({
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
        This is where we will copy all future clones in owner/reponame style.
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
  projects: Array<{ currentPath: string; owner: string; name: string }>;
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
        padding: 20,
        backgroundColor: `${theme.colors.primary}15`,
        borderRadius: '50%'
      }}>
        <Github size={40} color={theme.colors.primary} />
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
        <Github size={20} />
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
      Let's start exploring your repositories and building something awesome together.
    </p>
  </div>
);

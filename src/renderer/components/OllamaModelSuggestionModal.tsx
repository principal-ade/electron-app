import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { aiService } from '../main-process-api/AIService';
import {
  X,
  Download,
  Cpu,
  Code,
  Brain,
  Zap,
  Check,
  AlertCircle,
} from 'lucide-react';

interface ModelSuggestion {
  name: string;
  size: string;
  description: string;
  strengths: string[];
  category: 'code' | 'general' | 'small';
  recommended?: boolean;
}

interface OllamaModelSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  installedModels: string[];
  onModelSelected: (modelName: string) => void;
  onModelsChanged?: () => void;
}

// Curated list of models good for architectural analysis
const SUGGESTED_MODELS: ModelSuggestion[] = [
  {
    name: 'deepseek-coder-v2:16b',
    size: '8.9GB',
    description:
      'Specialized code understanding model with strong architectural analysis',
    strengths: [
      'Code comprehension',
      'Pattern recognition',
      'API understanding',
    ],
    category: 'code',
    recommended: true,
  },
  {
    name: 'llama3.2:3b',
    size: '2.0GB',
    description: 'Latest Llama model, good balance of speed and capability',
    strengths: ['Fast inference', 'Good reasoning', 'Structured output'],
    category: 'general',
  },
  {
    name: 'qwen2.5-coder:7b',
    size: '4.7GB',
    description:
      "Alibaba's code-focused model with strong multilingual support",
    strengths: ['Code analysis', 'Multiple languages', 'Good with types'],
    category: 'code',
  },
  {
    name: 'codellama:13b',
    size: '7.4GB',
    description:
      "Meta's code-specific model, excellent for understanding code structure",
    strengths: ['Code generation', 'Refactoring', 'Documentation'],
    category: 'code',
  },
  {
    name: 'mistral:7b',
    size: '4.1GB',
    description: 'Fast and efficient general purpose model',
    strengths: ['Speed', 'Instruction following', 'JSON output'],
    category: 'general',
  },
  {
    name: 'phi3:mini',
    size: '2.3GB',
    description: "Microsoft's small but capable model",
    strengths: ['Very fast', 'Low memory', 'Good for simple tasks'],
    category: 'small',
  },
  {
    name: 'granite-code:3b',
    size: '2.0GB',
    description: "IBM's code model trained on diverse codebases",
    strengths: ['Enterprise code', 'Documentation', 'Best practices'],
    category: 'code',
  },
  {
    name: 'starcoder2:3b',
    size: '1.7GB',
    description: 'Lightweight code model from BigCode',
    strengths: ['Fast', 'Good accuracy', 'Multi-language'],
    category: 'small',
  },
];

export const OllamaModelSuggestionModal: React.FC<
  OllamaModelSuggestionModalProps
> = ({
  isOpen,
  onClose,
  installedModels,
  onModelSelected,
  onModelsChanged,
}) => {
  const { theme } = useTheme();
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(
    new Set(),
  );
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, number>
  >({});
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'code' | 'general' | 'small'
  >('all');
  const [downloadQueue, setDownloadQueue] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setDownloadingModels(new Set());
      setDownloadProgress({});
      setDownloadQueue([]);
    }
  }, [isOpen]);

  // Process download queue
  useEffect(() => {
    if (downloadQueue.length > 0 && downloadingModels.size === 0) {
      const nextModel = downloadQueue[0];
      setDownloadQueue((prev) => prev.slice(1));
      handleDownload(nextModel);
    }
  }, [downloadQueue, downloadingModels]);

  // Listen for download progress
  useEffect(() => {
    const unsubscribe = aiService.onPullOllamaProgress((data) => {
      if (downloadingModels.has(data.progressId)) {
        setDownloadProgress((prev) => ({
          ...prev,
          [data.progressId]: data.percent || 0,
        }));

        if (data.status === 'success' || data.status === 'error') {
          setDownloadingModels((prev) => {
            const newSet = new Set(prev);
            newSet.delete(data.progressId);
            return newSet;
          });

          if (data.status === 'success' && onModelsChanged) {
            onModelsChanged();
          }
        }
      }
    });

    return () => unsubscribe();
  }, [downloadingModels, onModelsChanged]);

  const handleDownload = async (modelName: string) => {
    setDownloadingModels((prev) => new Set(prev).add(modelName));
    try {
      await aiService.pullOllamaModel({
        modelName,
        progressId: modelName,
      });
    } catch (error) {
      console.error('Error downloading model:', error);
      setDownloadingModels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });
    }
  };

  const handleDownloadClick = (modelName: string) => {
    if (downloadingModels.size === 0) {
      // If nothing is downloading, start immediately
      handleDownload(modelName);
    } else {
      // Add to queue
      setDownloadQueue((prev) => [...prev, modelName]);
    }
  };

  const filteredModels = SUGGESTED_MODELS.filter(
    (model) =>
      selectedCategory === 'all' || model.category === selectedCategory,
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'code':
        return <Code size={14} />;
      case 'general':
        return <Brain size={14} />;
      case 'small':
        return <Zap size={14} />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: theme.colors.text,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Cpu size={20} />
              Recommended Models for Architectural Analysis
            </h2>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '13px',
                color: theme.colors.textSecondary,
              }}
            >
              These models are optimized for understanding code structure and
              patterns
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Category Filter */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            gap: '8px',
          }}
        >
          {(['all', 'code', 'general', 'small'] as const).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                padding: '6px 16px',
                backgroundColor:
                  selectedCategory === category
                    ? theme.colors.primary
                    : theme.colors.backgroundSecondary,
                color:
                  selectedCategory === category
                    ? theme.colors.background
                    : theme.colors.text,
                border: `1px solid ${selectedCategory === category ? theme.colors.primary : theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {category !== 'all' && getCategoryIcon(category)}
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        {/* Model List */}
        <div
          style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gap: '12px',
            }}
          >
            {filteredModels.map((model) => {
              const isInstalled = installedModels.some((m) =>
                m.startsWith(model.name.split(':')[0]),
              );
              const isDownloading = downloadingModels.has(model.name);
              const isQueued = downloadQueue.includes(model.name);
              const progress = downloadProgress[model.name] || 0;

              return (
                <div
                  key={model.name}
                  style={{
                    padding: '16px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${model.recommended ? `${theme.colors.primary}40` : theme.colors.border}`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {model.recommended && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        padding: '4px 8px',
                        backgroundColor: `${theme.colors.primary}20`,
                        color: theme.colors.primary,
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      RECOMMENDED
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: theme.colors.text,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {getCategoryIcon(model.category)}
                        {model.name}
                        <span
                          style={{
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            fontWeight: 400,
                          }}
                        >
                          ({model.size})
                        </span>
                      </h3>
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: '13px',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {model.description}
                      </p>
                    </div>

                    {isInstalled ? (
                      <button
                        onClick={() =>
                          onModelSelected(model.name.split(':')[0])
                        }
                        style={{
                          padding: '8px 16px',
                          backgroundColor: `${theme.colors.success}20`,
                          color: theme.colors.success,
                          border: `1px solid ${theme.colors.success}40`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${theme.colors.success}30`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `${theme.colors.success}20`;
                        }}
                      >
                        <Check size={14} />
                        Use Model
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownloadClick(model.name)}
                        disabled={isDownloading || isQueued}
                        style={{
                          padding: '8px 16px',
                          backgroundColor:
                            isDownloading || isQueued
                              ? theme.colors.backgroundTertiary
                              : theme.colors.primary,
                          color:
                            isDownloading || isQueued
                              ? theme.colors.textSecondary
                              : theme.colors.background,
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor:
                            isDownloading || isQueued
                              ? 'not-allowed'
                              : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s',
                          minWidth: '120px',
                          justifyContent: 'center',
                        }}
                      >
                        {isDownloading ? (
                          <>
                            <div
                              style={{
                                width: '14px',
                                height: '14px',
                                border: '2px solid transparent',
                                borderTopColor: theme.colors.textSecondary,
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                              }}
                            />
                            {progress > 0
                              ? `${Math.round(progress)}%`
                              : 'Downloading...'}
                          </>
                        ) : isQueued ? (
                          <>
                            <Clock size={14} />
                            Queued
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            Download
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {model.strengths.map((strength, index) => (
                      <span
                        key={index}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: theme.colors.backgroundTertiary,
                          color: theme.colors.textSecondary,
                          borderRadius: '4px',
                          fontSize: '11px',
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        {strength}
                      </span>
                    ))}
                  </div>

                  {isDownloading && progress > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        backgroundColor: theme.colors.backgroundTertiary,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${progress}%`,
                          backgroundColor: theme.colors.primary,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          {/* Download queue status */}
          {(downloadingModels.size > 0 || downloadQueue.length > 0) && (
            <div
              style={{
                marginBottom: '12px',
                padding: '8px 12px',
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                fontSize: '12px',
                color: theme.colors.text,
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid transparent',
                    borderTopColor: theme.colors.primary,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                {downloadingModels.size > 0 && (
                  <span>
                    Downloading {Array.from(downloadingModels)[0].split(':')[0]}
                  </span>
                )}
                {downloadQueue.length > 0 && (
                  <span style={{ color: theme.colors.textSecondary }}>
                    • {downloadQueue.length} in queue
                  </span>
                )}
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <AlertCircle
              size={16}
              style={{ color: theme.colors.textSecondary, flexShrink: 0 }}
            />
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: theme.colors.textSecondary,
              }}
            >
              Code-specific models provide better architectural analysis. Small
              models are faster but less accurate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

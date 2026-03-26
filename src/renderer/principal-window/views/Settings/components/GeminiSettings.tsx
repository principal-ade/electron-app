import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { SecretsService } from '../../../../main-process-api/SecretsService';
import { UserPreferencesService } from '../../../../main-process-api/UserPreferencesService';
import {
  geminiClient,
  type GeminiModel,
} from '../../../../tipc/geminiClient';

const GEMINI_SECRETS_ID = 'app-gemini';

export const GeminiSettings: React.FC = () => {
  const { theme } = useTheme();

  // State
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-lite');
  const [models, setModels] = useState<GeminiModel[]>([]);

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load existing configuration
  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        // Load API key from secrets
        const existingKey = await SecretsService.getSingle(
          GEMINI_SECRETS_ID,
          'apiKey'
        );
        if (existingKey) {
          setApiKey(existingKey);
          setIsValid(true); // Assume valid if we have a stored key
        }

        // Load selected model from preferences
        const prefs = await UserPreferencesService.getPreferences();
        if (prefs?.gemini?.selectedModel) {
          setSelectedModel(prefs.gemini.selectedModel);
        }
      } catch (err) {
        console.error('Failed to load Gemini config:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const loadModels = async () => {
    if (!apiKey) return;

    setLoadingModels(true);
    try {
      const result = await geminiClient.listModels({ apiKey });
      if (result.success && result.models) {
        setModels(result.models);
      } else {
        console.error('Failed to load models:', result.error);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  // Load models when API key is valid
  useEffect(() => {
    if (isValid && apiKey) {
      loadModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, apiKey]);

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setValidating(true);
    setError(null);
    setIsValid(null);

    try {
      const result = await geminiClient.validateApiKey({ apiKey });
      setIsValid(result.success);
      if (!result.success) {
        setError(result.error || 'Invalid API key');
      }
    } catch (err) {
      setIsValid(false);
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // Save API key to secrets
      await SecretsService.store({
        repoId: GEMINI_SECRETS_ID,
        repoPath: 'app://gemini', // App-level secret, not repo-specific
        secrets: { apiKey },
      });

      // Save model preference
      await UserPreferencesService.updatePreferences({
        gemini: { selectedModel },
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      await SecretsService.delete(GEMINI_SECRETS_ID);
      await UserPreferencesService.updatePreferences({
        gemini: { selectedModel: undefined },
      });
      setApiKey('');
      setSelectedModel('gemini-2.5-flash-lite');
      setIsValid(null);
      setModels([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear');
    }
  };

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}
      >
        <Loader2
          size={24}
          style={{ animation: 'spin 1s linear infinite' }}
          color={theme.colors.textSecondary}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '32px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
          }}
        >
          <Sparkles size={20} color={theme.colors.primary} />
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 600,
              margin: 0,
              color: theme.colors.text,
            }}
          >
            Gemini AI Configuration
          </h3>
        </div>
        <p
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            margin: 0,
          }}
        >
          Configure your Google AI API key to enable AI-powered commit
          summaries in the activity feed.
        </p>
      </div>

      {/* API Key Input */}
      <div style={{ marginBottom: '24px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            color: theme.colors.text,
            marginBottom: '8px',
          }}
        >
          API Key
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setIsValid(null);
                setError(null);
              }}
              placeholder="Enter your Google AI API key"
              style={{
                width: '100%',
                padding: '10px 40px 10px 12px',
                fontSize: '14px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${
                  error
                    ? theme.colors.error
                    : isValid
                      ? theme.colors.success
                      : theme.colors.border
                }`,
                borderRadius: '8px',
                color: theme.colors.text,
                outline: 'none',
              }}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showApiKey ? (
                <EyeOff size={16} color={theme.colors.textSecondary} />
              ) : (
                <Eye size={16} color={theme.colors.textSecondary} />
              )}
            </button>
          </div>
          <button
            onClick={handleValidate}
            disabled={validating || !apiKey.trim()}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              color: theme.colors.text,
              cursor: validating || !apiKey.trim() ? 'not-allowed' : 'pointer',
              opacity: validating || !apiKey.trim() ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {validating ? (
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : isValid ? (
              <CheckCircle size={14} color={theme.colors.success} />
            ) : null}
            Validate
          </button>
        </div>

        {/* Validation feedback */}
        {isValid === true && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
              color: theme.colors.success,
              fontSize: '13px',
            }}
          >
            <CheckCircle size={14} />
            API key is valid
          </div>
        )}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
              color: theme.colors.error,
              fontSize: '13px',
            }}
          >
            <AlertCircle size={14} />
            {error}
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div style={{ marginBottom: '24px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            color: theme.colors.text,
            marginBottom: '8px',
          }}
        >
          Model
        </label>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={!isValid || loadingModels}
            style={{
              width: '100%',
              padding: '10px 36px 10px 12px',
              fontSize: '14px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              color: theme.colors.text,
              cursor: !isValid || loadingModels ? 'not-allowed' : 'pointer',
              opacity: !isValid || loadingModels ? 0.5 : 1,
              outline: 'none',
              appearance: 'none',
            }}
          >
            {models.length > 0 ? (
              models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))
            ) : (
              <>
                <option value="gemini-2.5-flash-lite">
                  Gemini 2.5 Flash-Lite
                </option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              </>
            )}
          </select>
          <ChevronDown
            size={16}
            color={theme.colors.textSecondary}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
        </div>
        {loadingModels && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px',
              color: theme.colors.textSecondary,
              fontSize: '13px',
            }}
          >
            <Loader2
              size={14}
              style={{ animation: 'spin 1s linear infinite' }}
            />
            Loading available models...
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            backgroundColor: theme.colors.primary,
            border: 'none',
            borderRadius: '8px',
            color: theme.colors.textOnPrimary,
            cursor: saving || !apiKey.trim() ? 'not-allowed' : 'pointer',
            opacity: saving || !apiKey.trim() ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {saving ? (
            <Loader2
              size={14}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          ) : saveSuccess ? (
            <CheckCircle size={14} />
          ) : null}
          {saveSuccess ? 'Saved!' : 'Save'}
        </button>
        {apiKey && (
          <button
            onClick={handleClear}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Help text */}
      <p
        style={{
          marginTop: '24px',
          fontSize: '12px',
          color: theme.colors.textSecondary,
        }}
      >
        Get your API key from{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: theme.colors.primary }}
        >
          Google AI Studio
        </a>
        . Your key is stored securely and never shared.
      </p>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

import React from 'react';
import { useTheme } from 'themed-markdown';
import { ValidationResult } from '../../../shared/tool-validation-types';

interface ToolValidationResultsProps {
  results: {
    validationId: string;
    templateName: string;
    results: ValidationResult[];
  };
  onClose: () => void;
}

export const ToolValidationResults: React.FC<ToolValidationResultsProps> = ({
  results,
  onClose,
}) => {
  const { theme } = useTheme();

  const getStatusIcon = (status: ValidationResult['status']) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'failure':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'skipped':
        return '⏭️';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: ValidationResult['status']) => {
    switch (status) {
      case 'success':
        return '#4CAF50';
      case 'failure':
        return '#f44336';
      case 'warning':
        return '#ff9800';
      case 'skipped':
        return theme.colors.textSecondary;
      default:
        return theme.colors.text;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '600px',
        backgroundColor: theme.colors.background,
        borderLeft: `1px solid ${theme.colors.border}`,
        boxShadow: '-4px 0 16px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInFromRight 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: theme.colors.text,
          }}
        >
          Validation Results
        </h3>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Template Info */}
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: theme.colors.backgroundLight,
          borderBottom: `1px solid ${theme.colors.border}`,
          fontSize: '14px',
          color: theme.colors.textSecondary,
        }}
      >
        {results.templateName}
      </div>

      {/* Results */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}
      >
        {results.results.map((result, index) => (
          <div
            key={index}
            style={{
              marginBottom: '20px',
              borderBottom:
                index < results.results.length - 1
                  ? `1px solid ${theme.colors.border}`
                  : 'none',
              paddingBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '16px' }}>
                {getStatusIcon(result.status)}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: getStatusColor(result.status),
                }}
              >
                {result.actionId}
              </span>
              {result.duration && (
                <span
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    marginLeft: 'auto',
                  }}
                >
                  {(result.duration / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            {(result.output || result.error) && (
              <pre
                style={{
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  padding: '12px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  margin: 0,
                  overflow: 'auto',
                  maxHeight: '300px',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                }}
              >
                {result.error ? (
                  <span style={{ color: '#f44336' }}>{result.error}</span>
                ) : (
                  result.output
                )}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            textAlign: 'center',
          }}
        >
          <div>
            <div
              style={{ fontSize: '20px', fontWeight: '600', color: '#4CAF50' }}
            >
              {results.results.filter((r) => r.status === 'success').length}
            </div>
            <div
              style={{ fontSize: '12px', color: theme.colors.textSecondary }}
            >
              Success
            </div>
          </div>
          <div>
            <div
              style={{ fontSize: '20px', fontWeight: '600', color: '#f44336' }}
            >
              {results.results.filter((r) => r.status === 'failure').length}
            </div>
            <div
              style={{ fontSize: '12px', color: theme.colors.textSecondary }}
            >
              Failed
            </div>
          </div>
          <div>
            <div
              style={{ fontSize: '20px', fontWeight: '600', color: '#ff9800' }}
            >
              {results.results.filter((r) => r.status === 'warning').length}
            </div>
            <div
              style={{ fontSize: '12px', color: theme.colors.textSecondary }}
            >
              Warnings
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: '600',
                color: theme.colors.textSecondary,
              }}
            >
              {results.results.filter((r) => r.status === 'skipped').length}
            </div>
            <div
              style={{ fontSize: '12px', color: theme.colors.textSecondary }}
            >
              Skipped
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

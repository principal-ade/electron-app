import React from 'react';
import { useTheme } from 'themed-markdown';
import { Package } from 'lucide-react';

interface PackageLayerExplanationProps {
  packagePath: string;
  validationName: string;
  onClose?: () => void;
}

export const PackageLayerExplanation: React.FC<
  PackageLayerExplanationProps
> = ({ packagePath, validationName, onClose }) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: theme.colors.backgroundLight,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '600px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        zIndex: 1000,
      }}
    >
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
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
      )}

      <h3
        style={{
          margin: '0 0 24px 0',
          fontSize: '20px',
          fontWeight: '600',
          color: theme.colors.text,
        }}
      >
        Understanding Validation Layers
      </h3>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          marginBottom: '32px',
          padding: '24px',
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '8px',
            }}
          >
            <Package size={48} />
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: theme.colors.text,
              marginBottom: '4px',
            }}
          >
            Package Layer
          </div>
          <code
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.backgroundSecondary,
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'inline-block',
            }}
          >
            {packagePath || 'root'}
          </code>
        </div>

        <div
          style={{
            fontSize: '24px',
            color: theme.colors.textSecondary,
          }}
        >
          +
        </div>

        <div
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '8px',
            }}
          >
            🛠️
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: theme.colors.text,
              marginBottom: '4px',
            }}
          >
            Validation
          </div>
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            {validationName}
          </div>
        </div>

        <div
          style={{
            fontSize: '24px',
            color: theme.colors.textSecondary,
          }}
        >
          =
        </div>

        <div
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '8px',
            }}
          >
            ✓
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: theme.colors.primary,
              marginBottom: '4px',
            }}
          >
            Validation Layer
          </div>
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            Configured & Active
          </div>
        </div>
      </div>

      <div
        style={{
          marginBottom: '24px',
        }}
      >
        <h4
          style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: theme.colors.text,
          }}
        >
          What does this mean?
        </h4>
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
          }}
        >
          A <strong>Validation Layer</strong> is created when you configure a
          validation tool for a specific package in your project.
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: '24px',
            fontSize: '14px',
            color: theme.colors.textSecondary,
            lineHeight: 1.8,
          }}
        >
          <li>
            The <strong>Package Layer</strong> represents a directory in your
            project that contains a package.json file
          </li>
          <li>
            The <strong>Validation</strong> is the tool (like ESLint,
            TypeScript, Jest) that checks your code
          </li>
          <li>
            When combined, they create a <strong>Validation Layer</strong> that
            runs checks on that specific package
          </li>
        </ul>
      </div>

      <div
        style={{
          padding: '16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          fontSize: '13px',
          color: theme.colors.textSecondary,
          lineHeight: 1.6,
        }}
      >
        <strong>Example:</strong> If you have a monorepo with multiple packages,
        each package can have its own validation layers. A package at{' '}
        <code
          style={{
            backgroundColor: theme.colors.backgroundTertiary,
            padding: '2px 4px',
            borderRadius: '2px',
          }}
        >
          packages/ui
        </code>{' '}
        might have ESLint and TypeScript validations, while{' '}
        <code
          style={{
            backgroundColor: theme.colors.backgroundTertiary,
            padding: '2px 4px',
            borderRadius: '2px',
          }}
        >
          packages/api
        </code>{' '}
        might have Jest and TSDoc validations.
      </div>
    </div>
  );
};

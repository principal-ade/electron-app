import React from 'react';
import {
  X,
  Package,
  Shield,
  AlertTriangle,
  TrendingUp,
  Scale,
  HelpCircle,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';

interface DependencyInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DependencyInfoModal: React.FC<DependencyInfoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Modal */}
        <div
          style={{
            backgroundColor: theme.colors.background,
            borderRadius: '12px',
            maxWidth: '700px',
            maxHeight: '80vh',
            width: '90%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow:
              '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px',
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: theme.colors.text,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <HelpCircle size={20} />
              Understanding Your Dependencies
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              padding: '20px',
              overflow: 'auto',
              flex: 1,
            }}
          >
            {/* Dependency Types */}
            <Section
              icon={<Package size={18} />}
              title="Dependency Types"
              theme={theme}
            >
              <InfoItem
                badge={{ text: 'prod', color: theme.colors.primary }}
                title="Production Dependencies"
                description="Required for your application to run in production. These are bundled with your app and affect its size and security."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'dev', color: '#8b5cf6' }}
                title="Development Dependencies"
                description="Only needed during development (build tools, testing, linters). Not included in production builds, so less critical for security."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'peer', color: '#6366f1' }}
                title="Peer Dependencies"
                description="Expected to be provided by the consumer of your package. Important for library authors to specify compatibility."
                theme={theme}
              />
            </Section>

            {/* Update Types */}
            <Section
              icon={<TrendingUp size={18} />}
              title="Version Updates (Semantic Versioning)"
              theme={theme}
            >
              <InfoItem
                badge={{ text: 'patch', color: '#10b981' }}
                title="Patch Updates (1.0.0 → 1.0.1)"
                description="Bug fixes only. Safe to update - should not break anything."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'minor', color: theme.colors.warning }}
                title="Minor Updates (1.0.0 → 1.1.0)"
                description="New features added in a backwards-compatible way. Generally safe but review changes."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'major', color: theme.colors.error }}
                title="Major Updates (1.0.0 → 2.0.0)"
                description="Breaking changes. May require code changes. Review migration guides before updating."
                theme={theme}
              />
            </Section>

            {/* Vulnerabilities */}
            <Section
              icon={<Shield size={18} />}
              title="Security Vulnerabilities"
              theme={theme}
            >
              <InfoItem
                badge={{ text: 'critical', color: theme.colors.error }}
                title="Critical Severity"
                description="Can be exploited remotely with no user interaction. Update immediately."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'high', color: '#f97316' }}
                title="High Severity"
                description="Significant security risk. Prioritize updating within days."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'moderate', color: theme.colors.warning }}
                title="Moderate Severity"
                description="Limited impact or requires specific conditions. Update within weeks."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'low', color: theme.colors.primary }}
                title="Low Severity"
                description="Minimal risk. Update during regular maintenance."
                theme={theme}
              />
            </Section>

            {/* Deprecated Packages */}
            <Section
              icon={<AlertTriangle size={18} />}
              title="Deprecated Packages"
              theme={theme}
            >
              <InfoItem
                badge={{ text: 'deprecated', color: theme.colors.error }}
                title="What Does Deprecated Mean?"
                description="The package author has officially marked it as obsolete. It will no longer receive updates, bug fixes, or security patches."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'action', color: theme.colors.warning }}
                title="Why You Should Care"
                description="Security vulnerabilities won't be fixed. Bugs remain unresolved. May break with future Node/browser updates. Shows technical debt."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'migrate', color: '#10b981' }}
                title="What To Do"
                description="Find the recommended replacement (usually mentioned in npm). Plan migration based on usage (production deps are urgent). Update during next sprint or major refactor."
                theme={theme}
              />
            </Section>

            {/* Licenses */}
            <Section
              icon={<Scale size={18} />}
              title="License Types"
              theme={theme}
            >
              <InfoItem
                badge={{ text: 'MIT', color: '#10b981' }}
                title="Permissive Licenses (MIT, Apache, BSD)"
                description="Few restrictions. Can use in commercial projects. Must include copyright notice."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'GPL', color: theme.colors.warning }}
                title="Copyleft Licenses (GPL, LGPL, AGPL)"
                description="Requires sharing source code of derivative works. Can impact your project's licensing."
                theme={theme}
              />
              <InfoItem
                badge={{ text: 'Proprietary', color: theme.colors.error }}
                title="Proprietary/Commercial"
                description="May require license purchase or have usage restrictions. Review terms carefully."
                theme={theme}
              />
            </Section>

            {/* Best Practices */}
            <Section
              icon={<HelpCircle size={18} />}
              title="Priority Order"
              theme={theme}
            >
              <div
                style={{
                  fontSize: '13px',
                  lineHeight: '1.8',
                  color: theme.colors.text,
                }}
              >
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>
                    <strong>🔴 Critical/High vulnerabilities</strong> - Fix
                    immediately, especially in production deps
                  </li>
                  <li>
                    <strong>🟠 Deprecated packages</strong> - Replace soon, they
                    won't get security fixes
                  </li>
                  <li>
                    <strong>🟡 Major updates in production</strong> - Review
                    breaking changes carefully
                  </li>
                  <li>
                    <strong>🟡 License issues</strong> - Resolve for legal
                    compliance
                  </li>
                  <li>
                    <strong>🟢 Patch updates</strong> - Safe to update, do
                    regularly
                  </li>
                  <li>
                    <strong>🟢 Dev dependency updates</strong> - Update for
                    better tooling
                  </li>
                </ol>
              </div>
            </Section>

            {/* Quick Actions */}
            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: theme.colors.backgroundLight,
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '12px',
                }}
              >
                💡 Quick Filter Tips
              </h4>
              <div
                style={{
                  fontSize: '12px',
                  lineHeight: '1.8',
                  color: theme.colors.textSecondary,
                }}
              >
                <div>
                  • <strong>Critical Security:</strong> Shows packages with
                  critical/high vulnerabilities
                </div>
                <div>
                  • <strong>Deprecated Packages:</strong> Shows obsolete
                  packages that need replacement
                </div>
                <div>
                  • <strong>Safe Updates:</strong> Shows only patch updates that
                  are safe to install
                </div>
                <div>
                  • <strong>License Review:</strong> Shows copyleft/proprietary
                  licenses needing attention
                </div>
                <div>
                  • <strong>Production Risk:</strong> Shows production deps with
                  major updates or vulnerabilities
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Helper Components
const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  theme: any;
  children: React.ReactNode;
}> = ({ icon, title, theme, children }) => (
  <div style={{ marginBottom: '24px' }}>
    <h3
      style={{
        fontSize: '15px',
        fontWeight: 600,
        color: theme.colors.text,
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {icon}
      {title}
    </h3>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {children}
    </div>
  </div>
);

const InfoItem: React.FC<{
  badge: { text: string; color: string };
  title: string;
  description: string;
  theme: any;
}> = ({ badge, title, description, theme }) => (
  <div
    style={{
      padding: '10px',
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: '6px',
      border: `1px solid ${theme.colors.border}`,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px',
      }}
    >
      <span
        style={{
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 500,
          backgroundColor: `${badge.color}20`,
          color: badge.color,
        }}
      >
        {badge.text}
      </span>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: theme.colors.text,
        }}
      >
        {title}
      </span>
    </div>
    <div
      style={{
        fontSize: '12px',
        color: theme.colors.textSecondary,
        lineHeight: '1.5',
      }}
    >
      {description}
    </div>
  </div>
);

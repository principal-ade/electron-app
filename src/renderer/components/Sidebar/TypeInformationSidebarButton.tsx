import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { FileType, ChevronDown } from 'lucide-react';
import { TypeScriptPackageService, type TypeScriptPackage } from '../../services/TypeScriptPackageService';

/**
 * Props for TypeInformationSidebarButton
 */
export interface TypeInformationSidebarButtonProps {
  /** Theme for styling */
  theme: Theme;
  /** Packages data from codebase-composition */
  packages?: PackageLayer[];
  /** Repository root path */
  repositoryPath?: string;
  /** Current panel layout */
  currentLayout?: { left: string; middle: string; right: string };
  /** Callback to change panel layout */
  onLayoutChange?: (layout: { left: string; middle: string; right: string }) => void;
  /** Panel event emitter for inter-panel communication */
  events?: {
    emit: (event: {
      type: string;
      source: string;
      payload: unknown;
      timestamp: number;
    }) => void;
  };
}

/**
 * TypeInformationSidebarButton Component
 *
 * A sidebar button that toggles the Type Information panel.
 * Supports package selection for monorepos with multiple TypeScript packages.
 */
export const TypeInformationSidebarButton: React.FC<TypeInformationSidebarButtonProps> = ({
  theme,
  packages,
  repositoryPath,
  currentLayout,
  onLayoutChange,
  events,
}) => {
  const [tsPackages, setTsPackages] = useState<TypeScriptPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<TypeScriptPackage | null>(null);
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Detect TypeScript packages from codebase-composition data
  useEffect(() => {
    if (repositoryPath && packages) {
      const foundPackages = TypeScriptPackageService.findTypeScriptPackages(
        packages,
        repositoryPath,
      );
      console.info('[TypeInformationSidebarButton] Found TypeScript packages:', foundPackages);
      setTsPackages(foundPackages);

      // Auto-select first package if only one exists
      if (foundPackages.length === 1) {
        setSelectedPackage(foundPackages[0]);
      } else if (foundPackages.length > 1) {
        setSelectedPackage(foundPackages[0]);
      } else {
        setSelectedPackage(null);
      }
    } else {
      setTsPackages([]);
      setSelectedPackage(null);
    }
  }, [repositoryPath, packages]);

  // Calculate dropdown position based on button location
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.top,
        right: window.innerWidth - rect.left + 4, // 4px gap
      });
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showPackageDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);

      if (isOutsideContainer && isOutsideDropdown) {
        setShowPackageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPackageDropdown]);

  // Handler for button click
  const handleTypeInfoClick = (packageToShow?: TypeScriptPackage) => {
    const targetPackage = packageToShow || selectedPackage;

    console.info('[TypeInformationSidebarButton] handleTypeInfoClick called', {
      targetPackage: targetPackage?.name,
      currentPanel: currentLayout?.right,
    });

    if (!targetPackage) {
      console.error('[TypeInformationSidebarButton] No TypeScript package selected');
      return;
    }

    setSelectedPackage(targetPackage);

    // Emit event with selected package info
    if (events) {
      events.emit({
        type: 'type-info:package-selected',
        source: 'type-information-sidebar-button',
        payload: {
          package: targetPackage,
        },
        timestamp: Date.now(),
      });
    }

    // Switch right panel to Type Information
    if (currentLayout && onLayoutChange) {
      onLayoutChange({ ...currentLayout, right: 'typeInformation' });
    }
  };

  // Derived state
  const isActive = currentLayout?.right === 'typeInformation';
  const buttonColor = isActive
    ? theme.colors.primary
    : theme.colors.textSecondary;

  // Don't render if no TypeScript packages found
  if (tsPackages.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          console.info('[TypeInformationSidebarButton] Button clicked', {
            isActive,
            packagesCount: tsPackages.length,
            showPackageDropdown,
            target: (e.target as HTMLElement).tagName,
          });

          // Single package: toggle panel directly
          if (tsPackages.length === 1) {
            handleTypeInfoClick();
          } else {
            // Multiple packages: show dropdown
            if (!showPackageDropdown) {
              updateDropdownPosition();
            }
            setShowPackageDropdown(!showPackageDropdown);
          }
        }}
        title={
          tsPackages.length === 1
            ? `Type Information (${selectedPackage?.name})`
            : 'Type Information (select package)'
        }
        aria-label="Type Information"
        style={{
          width: 'calc(100% - 20px)',
          height: '64px',
          margin: '4px 10px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: buttonColor,
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            background: isActive ? `${theme.colors.primary}20` : 'transparent',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = theme.colors.border;
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <FileType size={20} strokeWidth={1.5} />
          {tsPackages.length > 1 && (
            <ChevronDown
              size={10}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
          )}
        </div>
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            fontWeight: isActive
              ? theme.fontWeights.semibold
              : theme.fontWeights.body,
            lineHeight: theme.lineHeights.tight,
            textAlign: 'center',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Types
        </span>
      </button>

      {/* Dropdown for multiple packages */}
      {showPackageDropdown && tsPackages.length > 1 && dropdownPosition && (
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 10000,
            minWidth: '200px',
            fontFamily: theme.fonts.body,
          }}
        >
          {tsPackages.map((pkg) => (
            <button
              key={pkg.path}
              onClick={(e) => {
                e.stopPropagation();
                setShowPackageDropdown(false);
                handleTypeInfoClick(pkg);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background:
                  selectedPackage?.path === pkg.path
                    ? theme.colors.primary + '20'
                    : 'transparent',
                color: theme.colors.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: `${theme.fontSizes[1]}px`,
                borderBottom:
                  tsPackages[tsPackages.length - 1] !== pkg
                    ? `1px solid ${theme.colors.border}`
                    : 'none',
              }}
              onMouseEnter={(e) => {
                if (selectedPackage?.path !== pkg.path) {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPackage?.path !== pkg.path) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={{ fontWeight: theme.fontWeights.medium }}>
                {pkg.name}
              </div>
              <div
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  color: theme.colors.textTertiary,
                  marginTop: '2px',
                }}
              >
                {pkg.path.replace(repositoryPath || '', '').replace(/^\//, '') || '/'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

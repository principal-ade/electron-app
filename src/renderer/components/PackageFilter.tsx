import React from 'react';
import { useTheme } from 'themed-markdown';

interface PackageFilterProps {
  directory: string;
  selectedPackages: Set<string>;
  onPackageToggle: (packageName: string) => void;
  packages?: string[]; // Simple array of package names if needed
}

export const PackageFilter: React.FC<PackageFilterProps> = ({
  directory,
  selectedPackages,
  onPackageToggle,
  packages = [],
}) => {
  const { theme } = useTheme();

  // If no packages provided, don't render
  if (packages.length === 0) {
    return null;
  }

  return (
    <div
      className="px-4 py-3 border-b"
      style={{
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.backgroundSecondary,
      }}
    >
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(packages.length, 6)}, 1fr)`,
          width: '100%',
        }}
      >
        {packages.map((packageName) => {
          const isSelected = selectedPackages.has(packageName);

          return (
            <button
              key={packageName}
              onClick={() => onPackageToggle(packageName)}
              className={`
                px-4 py-2 text-sm rounded-md border transition-all duration-200
                text-center w-full overflow-hidden text-ellipsis whitespace-nowrap
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/20 text-blue-500 font-semibold'
                    : 'border-gray-600 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:border-blue-500 hover:text-gray-300'
                }
              `}
              title={packageName}
            >
              {packageName}
            </button>
          );
        })}
      </div>
    </div>
  );
};

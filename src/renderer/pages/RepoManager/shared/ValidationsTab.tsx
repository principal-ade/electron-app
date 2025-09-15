import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { 
  Package, 
  ChevronDown,
  FileSearch,
  AlertTriangle,
  FileCode,
  TestTube,
  Play,
  RefreshCw
} from 'lucide-react';
import type { Repository } from '../../../../shared/types/repository.types';
import type { FileTree } from "@principal-ai/repository-abstraction";
import type { PackageLayer } from "@principal-ai/codebase-composition";
import type { HighlightLayer } from "@principal-ai/code-city-react";
import { 
  ValidationResult,
  ValidationTool,
  ValidationIssue,
  ValidationSeverity,
  ValidationCategory,
  ValidationStatus
} from '../../../types/validation';
import { ValidationResultView } from '../../../components/validation/ValidationResultView';
import type { ViolationMonitoringResult } from '../../../services/ViolationMonitoringServiceIPC';
import { knipServiceIPC, type KnipAnalysisResult } from '../../../services/KnipServiceIPC';
import { testCoverageService, type TestCoverageResult } from '../../../services/TestCoverageServiceIPC';

type ValidationType = 'knip' | 'eslint' | 'typescript' | 'coverage';

interface ValidationsTabProps {
  repository: Repository;
  fileTree: FileTree | null;
  packageLayers?: PackageLayer[] | null;
  violationResult?: ViolationMonitoringResult | null;
  isMonitoring?: boolean;
  selectedPackage?: string | null;
  onPackageSelect?: (packagePath: string) => void;
  onRefresh?: (packagePath?: string, validationType?: string) => void;
  onHighlightChange?: (layers: HighlightLayer[]) => void;
}

export const ValidationsTab: React.FC<ValidationsTabProps> = ({
  repository,
  fileTree,
  packageLayers,
  violationResult,
  isMonitoring = false,
  selectedPackage: externalSelectedPackage,
  onPackageSelect,
  onRefresh,
  onHighlightChange,
}) => {
  const { theme } = useTheme();
  const [selectedValidationType, setSelectedValidationType] = useState<ValidationType>('eslint');
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [knipResult, setKnipResult] = useState<KnipAnalysisResult | null>(null);
  const [coverageResult, setCoverageResult] = useState<TestCoverageResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  // Find the selected package layer
  const selectedPackage = useMemo<PackageLayer | null>(() => {
    if (!packageLayers || packageLayers.length === 0) return null;
    
    // Default to first package if no selection
    if (!externalSelectedPackage) return packageLayers[0];
    
    // Find the selected package or fall back to first
    const found = packageLayers.find(pkg => pkg.packageData.path === externalSelectedPackage);
    return found || packageLayers[0];
  }, [packageLayers, externalSelectedPackage]);
  
  // Convert Coverage result to validation result format
  const convertCoverageToValidationResult = useCallback((coverageData: TestCoverageResult, currentSelectedPackage: PackageLayer | null): ValidationResult | null => {
    if (!coverageData || !currentSelectedPackage) return null;
    
    // Find the package coverage
    const packageCoverage = coverageData.packages.find(p => 
      p.packageName === currentSelectedPackage.packageData.name ||
      p.packagePath === currentSelectedPackage.packageData.path
    );
    
    if (!packageCoverage) return null;
    
    const issues: ValidationIssue[] = [];
    const threshold = 80; // Coverage threshold percentage
    
    // Convert file coverage to issues
    packageCoverage.fileCoverage.forEach(([filePath, coverage]) => {
      const avgCoverage = (
        coverage.statementCoverage + 
        coverage.branchCoverage + 
        coverage.functionCoverage
      ) / 3;
      
      if (avgCoverage < threshold) {
        issues.push({
          file: coverage.relativePath || filePath,
          line: 1,
          column: 1,
          severity: avgCoverage < 50 ? ValidationSeverity.Warning : ValidationSeverity.Info,
          message: `File has ${avgCoverage.toFixed(1)}% coverage (threshold: ${threshold}%)`,
          rule: 'coverage-threshold',
          category: 'coverage'
        });
        
        // Add specific coverage type issues
        if (coverage.statementCoverage < threshold) {
          issues.push({
            file: coverage.relativePath || filePath,
            line: 1,
            column: 1,
            severity: ValidationSeverity.Info,
            message: `Statement coverage: ${coverage.statementCoverage.toFixed(1)}%`,
            rule: 'statement-coverage',
            category: 'coverage'
          });
        }
        
        if (coverage.branchCoverage < threshold) {
          issues.push({
            file: coverage.relativePath || filePath,
            line: 1,
            column: 1,
            severity: ValidationSeverity.Info,
            message: `Branch coverage: ${coverage.branchCoverage.toFixed(1)}%`,
            rule: 'branch-coverage',
            category: 'coverage'
          });
        }
        
        if (coverage.functionCoverage < threshold) {
          issues.push({
            file: coverage.relativePath || filePath,
            line: 1,
            column: 1,
            severity: ValidationSeverity.Info,
            message: `Function coverage: ${coverage.functionCoverage.toFixed(1)}%`,
            rule: 'function-coverage',
            category: 'coverage'
          });
        }
      }
    });
    
    const filesWithIssues = new Set(issues.map(i => i.file));
    const warningCount = issues.filter(i => i.severity === ValidationSeverity.Warning).length;
    const infoCount = issues.filter(i => i.severity === ValidationSeverity.Info).length;
    
    const statementCoveragePercent = packageCoverage.totalStatements > 0 
      ? (packageCoverage.coveredStatements / packageCoverage.totalStatements) * 100 
      : 0;
    
    return {
      id: `coverage-${currentSelectedPackage.packageData.name}-${Date.now()}`,
      tool: ValidationTool.Jest,
      category: ValidationCategory.Testing,
      status: statementCoveragePercent >= threshold ? 
        ValidationStatus.Success : 
        ValidationStatus.Warning,
      scope: {
        packagePath: currentSelectedPackage.packageData.path,
        packageName: currentSelectedPackage.packageData.name,
        filesAnalyzed: {
          total: packageCoverage.fileCoverage.length,
          included: packageCoverage.fileCoverage.map(([path]) => path)
        }
      },
      summary: {
        totalIssues: issues.length,
        bySeverity: {
          errors: 0,
          warnings: warningCount,
          info: infoCount,
          suggestions: 0
        },
        filesWithIssues: filesWithIssues.size,
        totalFilesAnalyzed: packageCoverage.fileCoverage.length,
        duration: coverageData.collectionTime || 0,
        timestamp: new Date(coverageData.timestamp)
      },
      issues
    };
  }, []);
  
  // Convert Knip result to validation result format
  const convertKnipToValidationResult = useCallback((knipData: KnipAnalysisResult, currentSelectedPackage: PackageLayer | null): ValidationResult | null => {
    if (!knipData || !currentSelectedPackage) return null;
    
    const issues: ValidationIssue[] = [];
    
    // Convert unused files to issues
    if (knipData.unusedFiles) {
      for (const file of knipData.unusedFiles) {
        issues.push({
          file,
          line: 1,
          column: 1,
          severity: ValidationSeverity.Warning,
          message: 'Unused file - this file is not imported anywhere',
          rule: 'unused-file',
          category: 'unused-code'
        });
      }
    }
    
    // Convert unused exports to issues
    if (knipData.unusedExports) {
      for (const exp of knipData.unusedExports) {
        issues.push({
          file: exp.file,
          line: 1,
          column: 1,
          severity: ValidationSeverity.Warning,
          message: `Unused export: ${exp.export}`,
          rule: 'unused-export',
          category: 'unused-code'
        });
      }
    }
    
    // Convert unused dependencies to issues
    if (knipData.unusedDependencies) {
      for (const dep of knipData.unusedDependencies) {
        issues.push({
          file: 'package.json',
          line: 1,
          column: 1,
          severity: ValidationSeverity.Info,
          message: `Unused dependency: ${dep}`,
          rule: 'unused-dependency',
          category: 'dependencies'
        });
      }
    }
    
    // Convert unresolved imports to issues  
    if (knipData.unresolvedImports) {
      for (const imp of knipData.unresolvedImports) {
        issues.push({
          file: imp.file,
          line: 1,
          column: 1,
          severity: ValidationSeverity.Error,
          message: `Unresolved import: ${imp.import}`,
          rule: 'unresolved-import',
          category: 'imports'
        });
      }
    }
    
    const filesWithIssues = new Set(issues.map(i => i.file));
    const errorCount = issues.filter(i => i.severity === ValidationSeverity.Error).length;
    const warningCount = issues.filter(i => i.severity === ValidationSeverity.Warning).length;
    const infoCount = issues.filter(i => i.severity === ValidationSeverity.Info).length;
    
    return {
      id: `knip-${currentSelectedPackage.packageData.name}-${Date.now()}`,
      tool: ValidationTool.Knip,
      category: ValidationCategory.UnusedCode,
      status: errorCount > 0 ? ValidationStatus.Error : warningCount > 0 ? ValidationStatus.Warning : ValidationStatus.Success,
      scope: {
        packagePath: currentSelectedPackage.packageData.path,
        packageName: currentSelectedPackage.packageData.name,
        filesAnalyzed: {
          total: filesWithIssues.size,
          included: Array.from(filesWithIssues)
        }
      },
      summary: {
        totalIssues: issues.length,
        bySeverity: {
          errors: errorCount,
          warnings: warningCount,
          info: infoCount,
          suggestions: 0
        },
        filesWithIssues: filesWithIssues.size,
        totalFilesAnalyzed: filesWithIssues.size,
        duration: 0,
        timestamp: new Date()
      },
      issues,
      error: knipData.error ? { message: knipData.error } : undefined
    };
  }, []);
  
  // Convert violation monitoring result to validation result format
  const convertToValidationResult = useCallback((violationData: ViolationMonitoringResult, validationType: ValidationType, currentSelectedPackage: PackageLayer | null): ValidationResult | null => {
    if (!violationData || !currentSelectedPackage) return null;
    
    // Find the matching package - try multiple matching strategies
    let packageData = violationData.packages.find(pkg => 
      pkg.absolutePath === currentSelectedPackage.packageData.path
    );
    
    // If no match by absolute path, try by package name
    if (!packageData) {
      packageData = violationData.packages.find(pkg => 
        pkg.packageName === currentSelectedPackage.packageData.name
      );
    }
    
    if (!packageData) {
      console.error('Package matching failed:', {
        looking: currentSelectedPackage.packageData.path,
        available: violationData.packages.map(p => ({ 
          name: p.packageName, 
          absolutePath: p.absolutePath 
        }))
      });
      return null; // Return null instead of throwing - gracefully handle missing data
    }

    const issues: ValidationIssue[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfo = 0;
    const filesWithIssues = new Set<string>();
    
    // Extract violations based on validation type
    for (const [filePath, fileViolations] of packageData.fileViolations) {
      const relevantViolations = fileViolations.violations.filter(v => {
        if (validationType === 'eslint') return v.type === 'eslint';
        if (validationType === 'typescript') return v.type === 'typescript';
        return false;
      });
      
      for (const violation of relevantViolations) {
        const severity = violation.severity === 'error' ? ValidationSeverity.Error :
                        violation.severity === 'warning' ? ValidationSeverity.Warning :
                        ValidationSeverity.Info;
        
        issues.push({
          file: filePath,
          line: violation.line,
          column: violation.column,
          endLine: violation.endLine,
          endColumn: violation.endColumn,
          severity,
          message: violation.message,
          rule: violation.rule,
          category: validationType // Use the validationType as category since we're filtering by it
        });
        
        filesWithIssues.add(filePath);
        
        if (severity === ValidationSeverity.Error) totalErrors++;
        else if (severity === ValidationSeverity.Warning) totalWarnings++;
        else totalInfo++;
      }
    }
    
    // Calculate top issues
    const ruleCount = new Map<string, number>();
    for (const issue of issues) {
      if (issue.rule) {
        ruleCount.set(issue.rule, (ruleCount.get(issue.rule) || 0) + 1);
      }
    }
    
    const topIssues = Array.from(ruleCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([rule, count]) => ({
        rule,
        count,
        severity: issues.find(i => i.rule === rule)?.severity || ValidationSeverity.Warning
      }));
    
    return {
      id: `${validationType}-${packageData.packageName}-${Date.now()}`,
      tool: validationType === 'eslint' ? ValidationTool.ESLint : ValidationTool.TypeScript,
      category: validationType === 'eslint' ? ValidationCategory.CodeQuality : ValidationCategory.TypeSafety,
      status: totalErrors > 0 ? ValidationStatus.Error : ValidationStatus.Success,
      scope: {
        packagePath: packageData.packagePath,
        packageName: packageData.packageName,
        filesAnalyzed: {
          total: Array.from(packageData.fileViolations.keys()).length,
          included: Array.from(packageData.fileViolations.keys())
        }
      },
      summary: {
        totalIssues: issues.length,
        bySeverity: {
          errors: totalErrors,
          warnings: totalWarnings,
          info: totalInfo,
          suggestions: 0
        },
        filesWithIssues: filesWithIssues.size,
        totalFilesAnalyzed: Array.from(packageData.fileViolations.keys()).length,
        topIssues,
        duration: 0,
        timestamp: new Date()
      },
      issues
    };
  }, []);
  
  // Get current validation result from violation data, knip data, or coverage data
  const currentResult = useMemo(() => {
    if (selectedValidationType === 'knip' && knipResult) {
      return convertKnipToValidationResult(knipResult, selectedPackage);
    }
    
    if (selectedValidationType === 'coverage' && coverageResult) {
      return convertCoverageToValidationResult(coverageResult, selectedPackage);
    }
    
    if (!violationResult) return null;
    
    return convertToValidationResult(violationResult, selectedValidationType, selectedPackage);
  }, [violationResult, knipResult, coverageResult, selectedValidationType, selectedPackage, convertToValidationResult, convertKnipToValidationResult, convertCoverageToValidationResult]);
  

  // Auto-select first package when packages are available
  useEffect(() => {
    if (packageLayers && packageLayers.length > 0 && externalSelectedPackage === null) {
      onPackageSelect?.(packageLayers[0].packageData.path);
    }
  }, [packageLayers, externalSelectedPackage, onPackageSelect]);
  
  // Create highlight layer for selected package
  useEffect(() => {
    if (!selectedPackage) {
      onHighlightChange?.([]);
      return;
    }
    
    // Use the package path directly from packageData
    const packagePath = selectedPackage.packageData.path;
    
    const packageLayer = {
      id: 'selected-package',
      name: `Package: ${selectedPackage.packageData.name}`,
      enabled: true,
      color: '#6366f1', // Indigo
      opacity: 0.15,
      priority: 5,
      items: [{
        path: packagePath,
        type: 'directory' as const,
        renderStrategy: 'fill' as const
      }]
    };
    
    // Create highlight layer for validation results if available
    const layers: HighlightLayer[] = [packageLayer];
    
    if (currentResult && currentResult.issues.length > 0) {
      const filesWithIssues = new Set(currentResult.issues.map(i => i.file));
      const severityMap = new Map<string, ValidationSeverity>();
      
      // Get highest severity per file
      for (const issue of currentResult.issues) {
        const current = severityMap.get(issue.file);
        if (!current || issue.severity > current) {
          severityMap.set(issue.file, issue.severity);
        }
      }
      
      const issuesLayer = {
        id: 'validation-issues',
        name: `${currentResult.tool} Issues (${currentResult.summary.totalIssues})`,
        enabled: true,
        color: currentResult.summary.bySeverity.errors > 0 ? '#ef4444' : '#f59e0b',
        opacity: 0.4,
        borderWidth: 2,
        priority: 10,
        items: Array.from(filesWithIssues).map(file => ({
          path: file,
          type: 'file' as const,
          renderStrategy: 'border' as const
        }))
      };
      
      layers.push(issuesLayer);
    }
    
    onHighlightChange?.(layers);
  }, [selectedPackage, currentResult, onHighlightChange]);
  
  // Refresh validation data
  const refreshValidation = useCallback(async () => {
    if (!selectedPackage) return;
    
    if (selectedValidationType === 'knip') {
      setIsRunning(true);
      try {
        const result = await knipServiceIPC.runAnalysis(selectedPackage.packageData.path);
        setKnipResult(result);
      } catch (error) {
        console.error('[ValidationsTab] Error running Knip analysis:', error);
        setKnipResult({
          error: `Failed to run Knip analysis: ${error}`,
          hasIssues: false
        });
      } finally {
        setIsRunning(false);
      }
    } else if (selectedValidationType === 'coverage') {
      setIsRunning(true);
      try {
        const localPath = repository.localClones?.[0]?.path;
        if (!localPath) {
          throw new Error('No local repository path found');
        }
        
        // Handle root package case
        let packagePath = selectedPackage.packageData.path;
        if (packagePath === localPath) {
          packagePath = '.';
        } else if (packagePath.startsWith(localPath)) {
          packagePath = packagePath.substring(localPath.length + 1);
        }
        
        const result = await testCoverageService.collectCoverage(
          localPath,
          [{
            name: selectedPackage.packageData.name,
            path: packagePath
          }],
          { useCache: false, maxWorkers: 2 }
        );
        
        // Convert arrays back to Maps
        setCoverageResult(result);
      } catch (error) {
        console.error('[ValidationsTab] Error running Coverage analysis:', error);
        setCoverageResult(null);
      } finally {
        setIsRunning(false);
      }
    } else {
      // For ESLint/TypeScript, request specific type from parent
      onRefresh?.(selectedPackage.packageData.path, selectedValidationType);
    }
  }, [selectedValidationType, selectedPackage, repository.localClones, onRefresh]);

  // Helper to get relative path for a package
  const getRelativePath = (pkg: PackageLayer): string => {
    const repoPath = repository.localClones?.[0]?.path;
    if (!repoPath || pkg.packageData.path === repoPath) return 'root';
    
    const relative = pkg.packageData.path.replace(repoPath + '/', '');
    return relative || 'root';
  };

  // Validation type info
  const validationTypes: Array<{
    id: ValidationType;
    name: string;
    icon: React.ReactNode;
    color: string;
    description: string;
  }> = [
    {
      id: 'knip',
      name: 'Unused Code',
      icon: <FileSearch size={18} />,
      color: '#ff4444',
      description: 'Find unused files, exports, and dependencies'
    },
    {
      id: 'eslint',
      name: 'Code Quality',
      icon: <AlertTriangle size={18} />,
      color: '#f59e0b',
      description: 'Check for code style and quality issues'
    },
    {
      id: 'typescript',
      name: 'Type Safety',
      icon: <FileCode size={18} />,
      color: '#3178c6',
      description: 'Analyze TypeScript type errors'
    },
    {
      id: 'coverage',
      name: 'Test Coverage',
      icon: <TestTube size={18} />,
      color: '#10b981',
      description: 'View test coverage metrics'
    }
  ];

  const currentValidation = validationTypes.find(v => v.id === selectedValidationType);

  // Show message if no packages
  if (!selectedPackage) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: theme.colors.textSecondary
      }}>
        <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3 style={{ color: theme.colors.text, marginBottom: '8px' }}>No Packages Found</h3>
        <p>This repository doesn't contain any detectable packages.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: theme.colors.background
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundLight
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: '8px'
        }}>
          Code Validations
        </h2>
        <p style={{
          fontSize: '14px',
          color: theme.colors.textSecondary
        }}>
          Run various quality checks and validations on your packages
        </p>
      </div>

      {/* Controls Section */}
      <div style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary
      }}>
        {/* Package Selector */}
        {packageLayers && packageLayers.length > 0 && (
          <div style={{
            marginBottom: '16px',
            position: 'relative',
          }}>
            <label style={{
              fontSize: '12px',
              fontWeight: 600,
              color: theme.colors.textSecondary,
              marginBottom: '6px',
              display: 'block',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Select Package
            </label>
            <button
              onClick={() => setShowPackageDropdown(!showPackageDropdown)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={16} />
                <span style={{ fontWeight: 500 }}>
                  {selectedPackage?.name || 'Select a package'}
                </span>
                {selectedPackage && (
                  <span style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    fontWeight: 400
                  }}>
                    {getRelativePath(selectedPackage)}
                  </span>
                )}
              </span>
              <ChevronDown size={16} style={{
                transform: showPackageDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }} />
            </button>
            
            {showPackageDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 100,
                maxHeight: '300px',
                overflowY: 'auto',
              }}>
                {packageLayers.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => {
                      onPackageSelect?.(pkg.packageData.path);
                      setShowPackageDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: selectedPackage?.id === pkg.id ? theme.colors.backgroundTertiary : 'transparent',
                      color: theme.colors.text,
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedPackage?.id !== pkg.id) {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedPackage?.id !== pkg.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Package size={14} style={{ opacity: 0.7 }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{pkg.name}</div>
                        {getRelativePath(pkg) !== 'root' && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: theme.colors.textSecondary,
                            marginTop: '2px'
                          }}>
                            {getRelativePath(pkg)}
                          </div>
                        )}
                      </div>
                    </div>
                    {pkg.configFiles && Object.values(pkg.configFiles).some(c => c?.exists) && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        {pkg.configFiles.knip?.exists && (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: '#ff444420',
                            color: '#ff4444',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}>
                            KNIP
                          </span>
                        )}
                        {pkg.configFiles.eslint?.exists && (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: '#f59e0b20',
                            color: '#f59e0b',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}>
                            ESLint
                          </span>
                        )}
                        {pkg.configFiles.typescript?.exists && (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: '#3178c620',
                            color: '#3178c6',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}>
                            TS
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Validation Type Selector */}
        <div>
          <label style={{
            fontSize: '12px',
            fontWeight: 600,
            color: theme.colors.textSecondary,
            marginBottom: '8px',
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Validation Type
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px',
          }}>
            {validationTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedValidationType(type.id)}
                style={{
                  padding: '12px',
                  backgroundColor: selectedValidationType === type.id 
                    ? `${type.color}15`
                    : theme.colors.background,
                  color: selectedValidationType === type.id 
                    ? type.color
                    : theme.colors.text,
                  border: `1.5px solid ${
                    selectedValidationType === type.id 
                      ? type.color
                      : theme.colors.border
                  }`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  fontWeight: selectedValidationType === type.id ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (selectedValidationType !== type.id) {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedValidationType !== type.id) {
                    e.currentTarget.style.backgroundColor = theme.colors.background;
                  }
                }}
              >
                <div style={{ color: type.color }}>
                  {type.icon}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 'inherit' }}>
                  {type.name}
                </div>
              </button>
            ))}
          </div>
          {currentValidation && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: `${currentValidation.color}10`,
              borderLeft: `3px solid ${currentValidation.color}`,
              borderRadius: '4px',
            }}>
              <p style={{
                fontSize: '12px',
                color: theme.colors.text,
                margin: 0,
              }}>
                {currentValidation.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Action bar */}
        {selectedPackage && (
          <div style={{
            padding: '12px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.colors.backgroundSecondary
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <button
                onClick={refreshValidation}
                disabled={isMonitoring || isRunning}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: isMonitoring 
                    ? theme.colors.backgroundTertiary 
                    : currentValidation?.color || theme.colors.primary,
                  color: isMonitoring 
                    ? theme.colors.textTertiary 
                    : '#fff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: (isMonitoring || isRunning)
                    ? 'not-allowed' 
                    : 'pointer',
                  opacity: (isMonitoring || isRunning) ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {(isMonitoring || isRunning) ? (
                  <>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Run {currentValidation?.name}
                  </>
                )}
              </button>
              
              {currentResult && !isMonitoring && (
                <div style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary
                }}>
                  Last run: {new Date(currentResult.summary.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Results or placeholder */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {currentResult ? (
            <ValidationResultView
              result={currentResult}
              onFileSelect={() => {}}
              onIssueSelect={() => {}}
            />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '40px',
            }}>
              <div style={{
                textAlign: 'center',
                maxWidth: '400px'
              }}>
                <div style={{ 
                  color: currentValidation?.color,
                  marginBottom: '16px'
                }}>
                  {currentValidation?.icon}
                </div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '8px'
                }}>
                  {currentValidation?.name} Analysis
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: theme.colors.textSecondary
                }}>
                  Ready to analyze {selectedPackage?.packageData.name}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
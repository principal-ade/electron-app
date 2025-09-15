import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { Package, ChevronDown, FileSearch, AlertTriangle, FileCode, TestTube, Play, RefreshCw } from 'lucide-react';
import { ValidationTool, ValidationSeverity, ValidationCategory, ValidationStatus } from '../../../types/validation';
import { ValidationResultView } from '../../../components/validation/ValidationResultView';
import { knipServiceIPC } from '../../../services/KnipServiceIPC';
import { testCoverageService } from '../../../services/TestCoverageServiceIPC';
export const ValidationsTab = ({ repository, fileTree, packageLayers, violationResult, isMonitoring = false, selectedPackage: externalSelectedPackage, onPackageSelect, onRefresh, onHighlightChange, }) => {
    const { theme } = useTheme();
    const [selectedValidationType, setSelectedValidationType] = useState('eslint');
    const [showPackageDropdown, setShowPackageDropdown] = useState(false);
    const [knipResult, setKnipResult] = useState(null);
    const [coverageResult, setCoverageResult] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    // Find the selected package layer
    const selectedPackage = useMemo(() => {
        if (!packageLayers || packageLayers.length === 0)
            return null;
        // Default to first package if no selection
        if (!externalSelectedPackage)
            return packageLayers[0];
        // Find the selected package or fall back to first
        const found = packageLayers.find(pkg => pkg.packageData.path === externalSelectedPackage);
        return found || packageLayers[0];
    }, [packageLayers, externalSelectedPackage]);
    // Convert Coverage result to validation result format
    const convertCoverageToValidationResult = useCallback((coverageData, currentSelectedPackage) => {
        if (!coverageData || !currentSelectedPackage)
            return null;
        // Find the package coverage
        const packageCoverage = coverageData.packages.find(p => p.packageName === currentSelectedPackage.packageData.name ||
            p.packagePath === currentSelectedPackage.packageData.path);
        if (!packageCoverage)
            return null;
        const issues = [];
        const threshold = 80; // Coverage threshold percentage
        // Convert file coverage to issues
        packageCoverage.fileCoverage.forEach(([filePath, coverage]) => {
            const avgCoverage = (coverage.statementCoverage +
                coverage.branchCoverage +
                coverage.functionCoverage) / 3;
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
    const convertKnipToValidationResult = useCallback((knipData, currentSelectedPackage) => {
        if (!knipData || !currentSelectedPackage)
            return null;
        const issues = [];
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
    const convertToValidationResult = useCallback((violationData, validationType, currentSelectedPackage) => {
        if (!violationData || !currentSelectedPackage)
            return null;
        // Find the matching package - try multiple matching strategies
        let packageData = violationData.packages.find(pkg => pkg.absolutePath === currentSelectedPackage.packageData.path);
        // If no match by absolute path, try by package name
        if (!packageData) {
            packageData = violationData.packages.find(pkg => pkg.packageName === currentSelectedPackage.packageData.name);
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
        const issues = [];
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalInfo = 0;
        const filesWithIssues = new Set();
        // Extract violations based on validation type
        for (const [filePath, fileViolations] of packageData.fileViolations) {
            const relevantViolations = fileViolations.violations.filter(v => {
                if (validationType === 'eslint')
                    return v.type === 'eslint';
                if (validationType === 'typescript')
                    return v.type === 'typescript';
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
                if (severity === ValidationSeverity.Error)
                    totalErrors++;
                else if (severity === ValidationSeverity.Warning)
                    totalWarnings++;
                else
                    totalInfo++;
            }
        }
        // Calculate top issues
        const ruleCount = new Map();
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
        if (!violationResult)
            return null;
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
                    type: 'directory',
                    renderStrategy: 'fill'
                }]
        };
        // Create highlight layer for validation results if available
        const layers = [packageLayer];
        if (currentResult && currentResult.issues.length > 0) {
            const filesWithIssues = new Set(currentResult.issues.map(i => i.file));
            const severityMap = new Map();
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
                    type: 'file',
                    renderStrategy: 'border'
                }))
            };
            layers.push(issuesLayer);
        }
        onHighlightChange?.(layers);
    }, [selectedPackage, currentResult, onHighlightChange]);
    // Refresh validation data
    const refreshValidation = useCallback(async () => {
        if (!selectedPackage)
            return;
        if (selectedValidationType === 'knip') {
            setIsRunning(true);
            try {
                const result = await knipServiceIPC.runAnalysis(selectedPackage.packageData.path);
                setKnipResult(result);
            }
            catch (error) {
                console.error('[ValidationsTab] Error running Knip analysis:', error);
                setKnipResult({
                    error: `Failed to run Knip analysis: ${error}`,
                    hasIssues: false
                });
            }
            finally {
                setIsRunning(false);
            }
        }
        else if (selectedValidationType === 'coverage') {
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
                }
                else if (packagePath.startsWith(localPath)) {
                    packagePath = packagePath.substring(localPath.length + 1);
                }
                const result = await testCoverageService.collectCoverage(localPath, [{
                        name: selectedPackage.packageData.name,
                        path: packagePath
                    }], { useCache: false, maxWorkers: 2 });
                // Convert arrays back to Maps
                setCoverageResult(result);
            }
            catch (error) {
                console.error('[ValidationsTab] Error running Coverage analysis:', error);
                setCoverageResult(null);
            }
            finally {
                setIsRunning(false);
            }
        }
        else {
            // For ESLint/TypeScript, request specific type from parent
            onRefresh?.(selectedPackage.packageData.path, selectedValidationType);
        }
    }, [selectedValidationType, selectedPackage, repository.localClones, onRefresh]);
    // Helper to get relative path for a package
    const getRelativePath = (pkg) => {
        const repoPath = repository.localClones?.[0]?.path;
        if (!repoPath || pkg.packageData.path === repoPath)
            return 'root';
        const relative = pkg.packageData.path.replace(repoPath + '/', '');
        return relative || 'root';
    };
    // Validation type info
    const validationTypes = [
        {
            id: 'knip',
            name: 'Unused Code',
            icon: _jsx(FileSearch, { size: 18 }),
            color: '#ff4444',
            description: 'Find unused files, exports, and dependencies'
        },
        {
            id: 'eslint',
            name: 'Code Quality',
            icon: _jsx(AlertTriangle, { size: 18 }),
            color: '#f59e0b',
            description: 'Check for code style and quality issues'
        },
        {
            id: 'typescript',
            name: 'Type Safety',
            icon: _jsx(FileCode, { size: 18 }),
            color: '#3178c6',
            description: 'Analyze TypeScript type errors'
        },
        {
            id: 'coverage',
            name: 'Test Coverage',
            icon: _jsx(TestTube, { size: 18 }),
            color: '#10b981',
            description: 'View test coverage metrics'
        }
    ];
    const currentValidation = validationTypes.find(v => v.id === selectedValidationType);
    // Show message if no packages
    if (!selectedPackage) {
        return (_jsxs("div", { style: {
                padding: '40px',
                textAlign: 'center',
                color: theme.colors.textSecondary
            }, children: [_jsx(Package, { size: 48, style: { marginBottom: '16px', opacity: 0.5 } }), _jsx("h3", { style: { color: theme.colors.text, marginBottom: '8px' }, children: "No Packages Found" }), _jsx("p", { children: "This repository doesn't contain any detectable packages." })] }));
    }
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: theme.colors.background
        }, children: [_jsxs("div", { style: {
                    padding: '20px 24px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundLight
                }, children: [_jsx("h2", { style: {
                            fontSize: '20px',
                            fontWeight: 600,
                            color: theme.colors.text,
                            marginBottom: '8px'
                        }, children: "Code Validations" }), _jsx("p", { style: {
                            fontSize: '14px',
                            color: theme.colors.textSecondary
                        }, children: "Run various quality checks and validations on your packages" })] }), _jsxs("div", { style: {
                    padding: '16px 24px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundSecondary
                }, children: [packageLayers && packageLayers.length > 0 && (_jsxs("div", { style: {
                            marginBottom: '16px',
                            position: 'relative',
                        }, children: [_jsx("label", { style: {
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: theme.colors.textSecondary,
                                    marginBottom: '6px',
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }, children: "Select Package" }), _jsxs("button", { onClick: () => setShowPackageDropdown(!showPackageDropdown), style: {
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
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.borderColor = theme.colors.primary;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.borderColor = theme.colors.border;
                                }, children: [_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: '8px' }, children: [_jsx(Package, { size: 16 }), _jsx("span", { style: { fontWeight: 500 }, children: selectedPackage?.name || 'Select a package' }), selectedPackage && (_jsx("span", { style: {
                                                    fontSize: '12px',
                                                    color: theme.colors.textSecondary,
                                                    fontWeight: 400
                                                }, children: getRelativePath(selectedPackage) }))] }), _jsx(ChevronDown, { size: 16, style: {
                                            transform: showPackageDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s',
                                        } })] }), showPackageDropdown && (_jsx("div", { style: {
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
                                }, children: packageLayers.map((pkg) => (_jsxs("button", { onClick: () => {
                                        onPackageSelect?.(pkg.packageData.path);
                                        setShowPackageDropdown(false);
                                    }, style: {
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
                                    }, onMouseEnter: (e) => {
                                        if (selectedPackage?.id !== pkg.id) {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                        }
                                    }, onMouseLeave: (e) => {
                                        if (selectedPackage?.id !== pkg.id) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '10px' }, children: [_jsx(Package, { size: 14, style: { opacity: 0.7 } }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500 }, children: pkg.name }), getRelativePath(pkg) !== 'root' && (_jsx("div", { style: {
                                                                fontSize: '12px',
                                                                color: theme.colors.textSecondary,
                                                                marginTop: '2px'
                                                            }, children: getRelativePath(pkg) }))] })] }), pkg.configFiles && Object.values(pkg.configFiles).some(c => c?.exists) && (_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }, children: [pkg.configFiles.knip?.exists && (_jsx("span", { style: {
                                                        padding: '2px 6px',
                                                        backgroundColor: '#ff444420',
                                                        color: '#ff4444',
                                                        borderRadius: '4px',
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                    }, children: "KNIP" })), pkg.configFiles.eslint?.exists && (_jsx("span", { style: {
                                                        padding: '2px 6px',
                                                        backgroundColor: '#f59e0b20',
                                                        color: '#f59e0b',
                                                        borderRadius: '4px',
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                    }, children: "ESLint" })), pkg.configFiles.typescript?.exists && (_jsx("span", { style: {
                                                        padding: '2px 6px',
                                                        backgroundColor: '#3178c620',
                                                        color: '#3178c6',
                                                        borderRadius: '4px',
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                    }, children: "TS" }))] }))] }, pkg.id))) }))] })), _jsxs("div", { children: [_jsx("label", { style: {
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: theme.colors.textSecondary,
                                    marginBottom: '8px',
                                    display: 'block',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }, children: "Validation Type" }), _jsx("div", { style: {
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                    gap: '8px',
                                }, children: validationTypes.map((type) => (_jsxs("button", { onClick: () => setSelectedValidationType(type.id), style: {
                                        padding: '12px',
                                        backgroundColor: selectedValidationType === type.id
                                            ? `${type.color}15`
                                            : theme.colors.background,
                                        color: selectedValidationType === type.id
                                            ? type.color
                                            : theme.colors.text,
                                        border: `1.5px solid ${selectedValidationType === type.id
                                            ? type.color
                                            : theme.colors.border}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s',
                                        fontWeight: selectedValidationType === type.id ? 600 : 400,
                                    }, onMouseEnter: (e) => {
                                        if (selectedValidationType !== type.id) {
                                            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                        }
                                    }, onMouseLeave: (e) => {
                                        if (selectedValidationType !== type.id) {
                                            e.currentTarget.style.backgroundColor = theme.colors.background;
                                        }
                                    }, children: [_jsx("div", { style: { color: type.color }, children: type.icon }), _jsx("div", { style: { fontSize: '13px', fontWeight: 'inherit' }, children: type.name })] }, type.id))) }), currentValidation && (_jsx("div", { style: {
                                    marginTop: '8px',
                                    padding: '8px 12px',
                                    backgroundColor: `${currentValidation.color}10`,
                                    borderLeft: `3px solid ${currentValidation.color}`,
                                    borderRadius: '4px',
                                }, children: _jsx("p", { style: {
                                        fontSize: '12px',
                                        color: theme.colors.text,
                                        margin: 0,
                                    }, children: currentValidation.description }) }))] })] }), _jsxs("div", { style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }, children: [selectedPackage && (_jsx("div", { style: {
                            padding: '12px 24px',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: theme.colors.backgroundSecondary
                        }, children: _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }, children: [_jsx("button", { onClick: refreshValidation, disabled: isMonitoring || isRunning, style: {
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
                                    }, children: (isMonitoring || isRunning) ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { size: 16, style: { animation: 'spin 1s linear infinite' } }), "Refreshing..."] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { size: 16 }), "Run ", currentValidation?.name] })) }), currentResult && !isMonitoring && (_jsxs("div", { style: {
                                        fontSize: '12px',
                                        color: theme.colors.textSecondary
                                    }, children: ["Last run: ", new Date(currentResult.summary.timestamp).toLocaleTimeString()] }))] }) })), _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: currentResult ? (_jsx(ValidationResultView, { result: currentResult, onFileSelect: () => { }, onIssueSelect: () => { } })) : (_jsx("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                padding: '40px',
                            }, children: _jsxs("div", { style: {
                                    textAlign: 'center',
                                    maxWidth: '400px'
                                }, children: [_jsx("div", { style: {
                                            color: currentValidation?.color,
                                            marginBottom: '16px'
                                        }, children: currentValidation?.icon }), _jsxs("h3", { style: {
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            color: theme.colors.text,
                                            marginBottom: '8px'
                                        }, children: [currentValidation?.name, " Analysis"] }), _jsxs("p", { style: {
                                            fontSize: '14px',
                                            color: theme.colors.textSecondary
                                        }, children: ["Ready to analyze ", selectedPackage?.packageData.name] })] }) })) })] }), _jsx("style", { children: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      ` })] }));
};

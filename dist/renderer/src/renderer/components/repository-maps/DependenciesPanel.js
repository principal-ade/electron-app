import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useCallback, useMemo } from 'react';
import { Package, AlertCircle, RefreshCw, ExternalLink, Filter, HelpCircle, Shield, Zap, Scale, AlertTriangle, Check, TrendingUp, Copy, CheckCircle2, Circle } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { DependencyInfoModal } from './DependencyInfoModal';
import { PackageManagerService } from '../../main-process-api/PackageManagerService';
export const DependenciesPanel = ({ packageLayers, onAnalysisComplete, onPackageAnalysisStart, onPackageAnalysisEnd, onPackageSelected, onPackageDeselected }) => {
    const { theme } = useTheme();
    // Auto-select if only one package
    const initialPackage = useMemo(() => {
        if (packageLayers && packageLayers.length === 1) {
            return packageLayers[0].packageData.path;
        }
        return '';
    }, [packageLayers]);
    const [selectedPackage, setSelectedPackage] = useState(initialPackage);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState('');
    const [analysisResults, setAnalysisResults] = useState(null);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
    const [dependencyItems, setDependencyItems] = useState([]);
    const [filterType, setFilterType] = useState('all');
    const [showOutdatedOnly, setShowOutdatedOnly] = useState(false);
    const [showVulnerableOnly, setShowVulnerableOnly] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [smartFilter, setSmartFilter] = useState('none');
    const [selectedDependencies, setSelectedDependencies] = useState(new Set());
    const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
    // Update selectedPackage when packageLayers changes to single package
    React.useEffect(() => {
        if (packageLayers && packageLayers.length === 1 && !selectedPackage) {
            const singlePackagePath = packageLayers[0].packageData.path;
            setSelectedPackage(singlePackagePath);
            // Notify parent about auto-selection
            onPackageSelected?.(singlePackagePath, packageLayers[0].packageData.name);
        }
    }, [packageLayers, selectedPackage, onPackageSelected]);
    // Get selected package data
    const selectedPackageData = useMemo(() => {
        if (!selectedPackage || !packageLayers)
            return null;
        return packageLayers.find(pkg => pkg.packageData.path === selectedPackage);
    }, [selectedPackage, packageLayers]);
    // Filter dependencies based on current filters
    const filteredDependencies = useMemo(() => {
        let filtered = [...dependencyItems];
        // Apply smart filters first
        switch (smartFilter) {
            case 'critical-security':
                // Show only packages with critical or high vulnerabilities
                filtered = filtered.filter(dep => dep.vulnerabilities &&
                    dep.vulnerabilities.some(v => v.severity === 'critical' || v.severity === 'high'));
                break;
            case 'deprecated':
                // Show only deprecated packages
                filtered = filtered.filter(dep => dep.isDeprecated === true);
                break;
            case 'safe-updates':
                // Show only outdated packages with patch updates
                filtered = filtered.filter(dep => dep.isOutdated && dep.updateType === 'patch');
                break;
            case 'license-review':
                // Show packages with copyleft or proprietary licenses
                filtered = filtered.filter(dep => dep.licenseType === 'copyleft' || dep.licenseType === 'proprietary');
                break;
            case 'production-risk':
                // Show production dependencies with major updates or vulnerabilities
                filtered = filtered.filter(dep => dep.dependencyType === 'production' &&
                    (dep.updateType === 'major' || (dep.vulnerabilities && dep.vulnerabilities.length > 0)));
                break;
        }
        // Apply regular filters only if no smart filter is active
        if (smartFilter === 'none') {
            // Filter by type
            if (filterType !== 'all') {
                filtered = filtered.filter(dep => dep.dependencyType === filterType);
            }
            // Filter outdated only
            if (showOutdatedOnly) {
                filtered = filtered.filter(dep => dep.isOutdated);
            }
            // Filter vulnerable only
            if (showVulnerableOnly) {
                filtered = filtered.filter(dep => dep.vulnerabilities && dep.vulnerabilities.length > 0);
            }
        }
        // Sort by name
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        return filtered;
    }, [dependencyItems, filterType, showOutdatedOnly, showVulnerableOnly, smartFilter]);
    // Toggle dependency selection
    const toggleDependencySelection = useCallback((depKey) => {
        setSelectedDependencies(prev => {
            const newSet = new Set(prev);
            if (newSet.has(depKey)) {
                newSet.delete(depKey);
            }
            else {
                newSet.add(depKey);
            }
            return newSet;
        });
    }, []);
    // Select all outdated dependencies
    const selectAllOutdated = useCallback(() => {
        const outdatedDeps = filteredDependencies
            .filter(dep => dep.isOutdated)
            .map(dep => `${dep.name}-${dep.dependencyType}`);
        setSelectedDependencies(new Set(outdatedDeps));
    }, [filteredDependencies]);
    // Clear selection
    const clearSelection = useCallback(() => {
        setSelectedDependencies(new Set());
    }, []);
    // Generate update prompt for agent
    const generateUpdatePrompt = useCallback(() => {
        const selectedDepItems = dependencyItems.filter(dep => selectedDependencies.has(`${dep.name}-${dep.dependencyType}`));
        const updateList = selectedDepItems.map(dep => {
            let info = `- ${dep.name}: ${dep.currentVersion} → ${dep.latestVersion} (${dep.updateType} update)`;
            if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
                const criticalCount = dep.vulnerabilities.filter(v => v.severity === 'critical').length;
                const highCount = dep.vulnerabilities.filter(v => v.severity === 'high').length;
                if (criticalCount > 0 || highCount > 0) {
                    info += ` [WARNING] Has ${criticalCount > 0 ? `${criticalCount} critical` : ''}${criticalCount > 0 && highCount > 0 ? ' and ' : ''}${highCount > 0 ? `${highCount} high` : ''} vulnerabilities`;
                }
            }
            if (dep.isDeprecated) {
                info += ` [DEPRECATED] Package is deprecated`;
            }
            return info;
        }).join('\n');
        const prompt = `Can you update the following dependencies safely? If so, please update them. If not, tell me why.

Package: ${selectedPackageData?.packageData.name}
Path: ${selectedPackageData?.packageData.path}

Dependencies to update:
${updateList}

Please check for breaking changes and compatibility issues before updating.`;
        // Copy to clipboard
        navigator.clipboard.writeText(prompt).then(() => {
            setShowUpdatePrompt(true);
            setTimeout(() => setShowUpdatePrompt(false), 3000);
        });
    }, [selectedDependencies, dependencyItems, selectedPackageData]);
    // Badge style helpers
    const getUpdateBadgeStyle = (updateType) => {
        const baseStyle = {
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500'
        };
        switch (updateType) {
            case 'major': return { ...baseStyle, backgroundColor: `${theme.colors.error}20`, color: theme.colors.error };
            case 'minor': return { ...baseStyle, backgroundColor: `${theme.colors.warning}20`, color: theme.colors.warning };
            case 'patch': return { ...baseStyle, backgroundColor: '#10b98120', color: '#10b981' };
            default: return { ...baseStyle, backgroundColor: theme.colors.backgroundLight, color: theme.colors.textSecondary };
        }
    };
    const getDependencyTypeBadgeStyle = (type) => {
        const baseStyle = {
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500'
        };
        switch (type) {
            case 'production': return { ...baseStyle, backgroundColor: `${theme.colors.primary}20`, color: theme.colors.primary };
            case 'development': return { ...baseStyle, backgroundColor: '#8b5cf620', color: '#8b5cf6' };
            case 'peer': return { ...baseStyle, backgroundColor: '#6366f120', color: '#6366f1' };
            default: return { ...baseStyle, backgroundColor: theme.colors.backgroundLight, color: theme.colors.textSecondary };
        }
    };
    const getLicenseBadgeStyle = (licenseType) => {
        const baseStyle = {
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500'
        };
        switch (licenseType) {
            case 'permissive': return { ...baseStyle, backgroundColor: '#10b98120', color: '#10b981' };
            case 'copyleft': return { ...baseStyle, backgroundColor: `${theme.colors.warning}20`, color: theme.colors.warning };
            case 'proprietary': return { ...baseStyle, backgroundColor: `${theme.colors.error}20`, color: theme.colors.error };
            default: return { ...baseStyle, backgroundColor: theme.colors.backgroundLight, color: theme.colors.textSecondary };
        }
    };
    const getSeverityBadgeStyle = (severity) => {
        const baseStyle = {
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '500'
        };
        switch (severity) {
            case 'critical': return { ...baseStyle, backgroundColor: `${theme.colors.error}20`, color: theme.colors.error };
            case 'high': return { ...baseStyle, backgroundColor: '#f9731620', color: '#f97316' };
            case 'moderate': return { ...baseStyle, backgroundColor: `${theme.colors.warning}20`, color: theme.colors.warning };
            case 'low': return { ...baseStyle, backgroundColor: `${theme.colors.primary}20`, color: theme.colors.primary };
            default: return { ...baseStyle, backgroundColor: theme.colors.backgroundLight, color: theme.colors.textSecondary };
        }
    };
    // Handle analysis
    const handleAnalyze = useCallback(async () => {
        if (!selectedPackageData)
            return;
        setIsAnalyzing(true);
        setError(null);
        setAnalysisStatus('Preparing to analyze dependencies...');
        setAnalysisResults(null);
        setProgress({ current: 0, total: 0, phase: 'starting' });
        // Notify parent that analysis started
        onPackageAnalysisStart?.(selectedPackageData.packageData.path, selectedPackageData.packageData.name);
        try {
            // Get package data
            const { dependencies, devDependencies, peerDependencies } = selectedPackageData.packageData;
            // Extract all dependencies with their types
            const allDeps = [];
            if (dependencies) {
                Object.entries(dependencies).forEach(([name, version]) => {
                    allDeps.push({ name, currentVersion: version, type: 'production' });
                });
            }
            if (devDependencies) {
                Object.entries(devDependencies).forEach(([name, version]) => {
                    allDeps.push({ name, currentVersion: version, type: 'development' });
                });
            }
            if (peerDependencies) {
                Object.entries(peerDependencies).forEach(([name, version]) => {
                    allDeps.push({ name, currentVersion: version, type: 'peer' });
                });
            }
            if (allDeps.length === 0) {
                setAnalysisStatus('No dependencies found in this package');
                setIsAnalyzing(false);
                return;
            }
            setProgress({ current: 0, total: allDeps.length, phase: 'checking-versions' });
            setAnalysisStatus(`Checking ${allDeps.length} dependencies for updates...`);
            // Check versions
            const versionResults = await PackageManagerService.checkVersions(allDeps.map(d => ({ name: d.name, currentVersion: d.currentVersion })), 'npm', { batchSize: 5 });
            // Count outdated
            const outdatedCount = versionResults.filter((r) => r.isOutdated).length;
            setProgress({ current: 0, total: allDeps.length, phase: 'checking-licenses' });
            setAnalysisStatus('Analyzing licenses...');
            // Check licenses
            const licenseResults = await PackageManagerService.checkLicenses(allDeps.map(d => ({ name: d.name, currentVersion: d.currentVersion })), 'npm', { batchSize: 5 });
            // Count license issues (copyleft or proprietary)
            const licenseIssues = licenseResults.filter((r) => r.license?.licenseType === 'copyleft' ||
                r.license?.licenseType === 'proprietary').length;
            setProgress({ current: 0, total: allDeps.length, phase: 'checking-vulnerabilities' });
            setAnalysisStatus('Scanning for vulnerabilities...');
            // Check vulnerabilities
            const vulnerabilityResults = await PackageManagerService.checkVulnerabilities(allDeps.map(d => ({ name: d.name, currentVersion: d.currentVersion })), 'npm', { batchSize: 5 });
            // Count vulnerabilities
            const vulnerabilityCount = vulnerabilityResults.reduce((acc, r) => acc + (r.vulnerabilities?.length || 0), 0);
            // Create DependencyItem objects
            const items = allDeps.map(dep => {
                const versionResult = versionResults.find((r) => r.packageName === dep.name);
                const licenseResult = licenseResults.find((r) => r.packageName === dep.name);
                const vulnerabilityResult = vulnerabilityResults.find((r) => r.packageName === dep.name);
                return {
                    name: dep.name,
                    currentVersion: dep.currentVersion,
                    latestVersion: versionResult?.latestVersion,
                    updateType: versionResult?.updateType,
                    isOutdated: versionResult?.isOutdated || false,
                    isDeprecated: versionResult?.isDeprecated,
                    license: licenseResult?.license?.license,
                    licenseType: licenseResult?.license?.licenseType,
                    dependencyType: dep.type,
                    vulnerabilities: vulnerabilityResult?.vulnerabilities || []
                };
            });
            setDependencyItems(items);
            // Prepare results
            const results = {
                packageName: selectedPackageData.packageData.name,
                packagePath: selectedPackageData.packageData.path,
                totalDependencies: allDeps.length,
                outdatedCount,
                vulnerabilityCount,
                licenseIssues,
                versionResults,
                vulnerabilityResults,
                licenseResults
            };
            setAnalysisResults(results);
            setAnalysisStatus(''); // Clear status after completion
            onAnalysisComplete?.(results);
        }
        catch (err) {
            console.error('Analysis error:', err);
            setError(err instanceof Error ? err.message : 'Failed to analyze dependencies');
            setAnalysisStatus('');
            onPackageAnalysisEnd?.(); // Clear highlight on error
        }
        finally {
            setIsAnalyzing(false);
            setProgress({ current: 0, total: 0, phase: '' });
        }
    }, [selectedPackageData, onAnalysisComplete]);
    // Progress listener setup
    React.useEffect(() => {
        const cleanupFns = [];
        // Version check progress
        const versionCleanup = PackageManagerService.onVersionCheckProgress((data) => {
            setProgress(prev => ({
                ...prev,
                current: data.current,
                total: data.total,
                phase: 'checking-versions'
            }));
            setAnalysisStatus(`Checking versions: ${data.current}/${data.total}`);
        });
        cleanupFns.push(versionCleanup);
        // License check progress
        const licenseCleanup = PackageManagerService.onLicenseCheckProgress((data) => {
            setProgress(prev => ({
                ...prev,
                current: data.current,
                total: data.total,
                phase: 'checking-licenses'
            }));
            setAnalysisStatus(`Checking licenses: ${data.current}/${data.total}`);
        });
        cleanupFns.push(licenseCleanup);
        // Vulnerability check progress
        const vulnCleanup = PackageManagerService.onVulnerabilityCheckProgress((data) => {
            setProgress(prev => ({
                ...prev,
                current: data.current,
                total: data.total,
                phase: 'checking-vulnerabilities'
            }));
            setAnalysisStatus(`Scanning vulnerabilities: ${data.current}/${data.total}`);
        });
        cleanupFns.push(vulnCleanup);
        return () => {
            cleanupFns.forEach(cleanup => cleanup());
        };
    }, []);
    return (_jsxs("div", { style: {
            padding: '16px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        }, children: [_jsxs("div", { children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '4px'
                        }, children: [_jsxs("h3", { style: {
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: theme.colors.text,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }, children: [_jsx(Package, { size: 16 }), "Dependencies Analysis"] }), _jsxs("button", { onClick: () => setShowInfoModal(true), style: {
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    borderRadius: '4px',
                                    border: `1px solid ${theme.colors.border}`,
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    color: theme.colors.primary,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = `${theme.colors.primary}20`;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                }, children: [_jsx(HelpCircle, { size: 12 }), "Learn More"] })] }), _jsx("p", { style: {
                            fontSize: '12px',
                            color: theme.colors.textSecondary
                        }, children: "Analyze package dependencies for updates, vulnerabilities, and license compliance" })] }), !analysisResults ? (
            // Only show selector if more than one package
            packageLayers && packageLayers.length > 1 ? (_jsxs("div", { children: [_jsx("label", { style: {
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: theme.colors.textSecondary,
                            marginBottom: '6px'
                        }, children: "Select Package" }), _jsxs("select", { value: selectedPackage, onChange: (e) => {
                            const newValue = e.target.value;
                            const prevValue = selectedPackage;
                            setSelectedPackage(newValue);
                            setAnalysisResults(null);
                            setDependencyItems([]);
                            setError(null);
                            setAnalysisStatus('');
                            // Handle package selection/deselection callbacks
                            if (prevValue && prevValue !== newValue) {
                                // Deselect previous package
                                onPackageDeselected?.();
                            }
                            if (newValue && newValue !== prevValue) {
                                // Select new package
                                const selectedPackageData = packageLayers?.find(pkg => pkg.packageData.path === newValue);
                                if (selectedPackageData) {
                                    onPackageSelected?.(selectedPackageData.packageData.path, selectedPackageData.packageData.name);
                                }
                            }
                            else if (!newValue) {
                                // Nothing selected
                                onPackageDeselected?.();
                            }
                        }, disabled: isAnalyzing || !packageLayers || packageLayers.length === 0, style: {
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.backgroundSecondary,
                            color: theme.colors.text,
                            fontSize: '13px',
                            cursor: 'pointer'
                        }, children: [_jsx("option", { value: "", children: "Choose a package..." }), packageLayers?.map(pkg => (_jsxs("option", { value: pkg.packageData.path, children: [pkg.packageData.name, " (", pkg.packageData.path, ")"] }, pkg.packageData.path)))] })] })) : packageLayers && packageLayers.length === 1 ? (
            // Single package - show info without selector
            _jsx("div", { style: {
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`
                }, children: _jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }, children: [_jsx(Package, { size: 16, color: theme.colors.primary }), _jsxs("div", { children: [_jsx("h4", { style: {
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        margin: 0
                                    }, children: packageLayers[0].packageData.name }), _jsx("p", { style: {
                                        fontSize: '11px',
                                        color: theme.colors.textSecondary,
                                        margin: 0,
                                        marginTop: '2px'
                                    }, children: packageLayers[0].packageData.path })] })] }) })) : null) : (_jsxs("div", { style: {
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px'
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }, children: [_jsx(Package, { size: 16, color: theme.colors.primary }), _jsxs("div", { children: [_jsx("h4", { style: {
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    color: theme.colors.text,
                                                    margin: 0
                                                }, children: analysisResults.packageName }), _jsxs("p", { style: {
                                                    fontSize: '11px',
                                                    color: theme.colors.textSecondary,
                                                    margin: 0,
                                                    marginTop: '2px'
                                                }, children: [analysisResults.packagePath, " \u2022 ", analysisResults.totalDependencies, " dependencies"] })] })] }), packageLayers && packageLayers.length > 1 && (_jsx("button", { onClick: () => {
                                    setAnalysisResults(null);
                                    setDependencyItems([]);
                                    setSmartFilter('none');
                                    setSelectedDependencies(new Set());
                                    onPackageAnalysisEnd?.(); // Clear highlight when changing package
                                }, style: {
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    borderRadius: '4px',
                                    border: `1px solid ${theme.colors.border}`,
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.textSecondary,
                                    cursor: 'pointer'
                                }, children: "Change Package" }))] }), _jsxs("div", { style: {
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap'
                        }, children: [(() => {
                                const criticalCount = dependencyItems.filter(dep => dep.vulnerabilities &&
                                    dep.vulnerabilities.some(v => v.severity === 'critical' || v.severity === 'high')).length;
                                const hasCritical = criticalCount > 0;
                                return (_jsxs("div", { onClick: () => {
                                        if (hasCritical) {
                                            setSmartFilter(smartFilter === 'critical-security' ? 'none' : 'critical-security');
                                        }
                                    }, style: {
                                        padding: '6px 10px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        borderRadius: '6px',
                                        border: `1px solid ${hasCritical ? theme.colors.error : '#10b981'}`,
                                        backgroundColor: hasCritical ? `${theme.colors.error}15` : '#10b98115',
                                        color: hasCritical ? theme.colors.error : '#10b981',
                                        cursor: hasCritical ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s'
                                    }, children: [hasCritical ? _jsx(Shield, { size: 12 }) : _jsx(Check, { size: 12 }), hasCritical ? `${criticalCount} Critical` : 'No Critical Issues'] }));
                            })(), (() => {
                                const deprecatedCount = dependencyItems.filter(d => d.isDeprecated).length;
                                const hasDeprecated = deprecatedCount > 0;
                                return (_jsxs("div", { onClick: () => {
                                        if (hasDeprecated) {
                                            setSmartFilter(smartFilter === 'deprecated' ? 'none' : 'deprecated');
                                        }
                                    }, style: {
                                        padding: '6px 10px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        borderRadius: '6px',
                                        border: `1px solid ${hasDeprecated ? theme.colors.warning : '#10b981'}`,
                                        backgroundColor: hasDeprecated ? `${theme.colors.warning}15` : '#10b98115',
                                        color: hasDeprecated ? theme.colors.warning : '#10b981',
                                        cursor: hasDeprecated ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }, children: [hasDeprecated ? _jsx(AlertCircle, { size: 12 }) : _jsx(Check, { size: 12 }), hasDeprecated ? `${deprecatedCount} Deprecated` : 'No Deprecated'] }));
                            })(), (() => {
                                const outdatedCount = dependencyItems.filter(dep => dep.isOutdated).length;
                                const hasOutdated = outdatedCount > 0;
                                return (_jsxs("div", { style: {
                                        padding: '6px 10px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        borderRadius: '6px',
                                        border: `1px solid ${hasOutdated ? theme.colors.primary : '#10b981'}`,
                                        backgroundColor: hasOutdated ? `${theme.colors.primary}15` : '#10b98115',
                                        color: hasOutdated ? theme.colors.primary : '#10b981',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }, children: [hasOutdated ? _jsx(TrendingUp, { size: 12 }) : _jsx(Check, { size: 12 }), hasOutdated ? `${outdatedCount} Outdated` : 'All Up-to-date'] }));
                            })(), (() => {
                                const licenseIssues = dependencyItems.filter(dep => dep.licenseType === 'copyleft' || dep.licenseType === 'proprietary').length;
                                const hasLicenseIssues = licenseIssues > 0;
                                return (_jsxs("div", { onClick: () => {
                                        if (hasLicenseIssues) {
                                            setSmartFilter(smartFilter === 'license-review' ? 'none' : 'license-review');
                                        }
                                    }, style: {
                                        padding: '6px 10px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        borderRadius: '6px',
                                        border: `1px solid ${hasLicenseIssues ? theme.colors.warning : '#10b981'}`,
                                        backgroundColor: hasLicenseIssues ? `${theme.colors.warning}15` : '#10b98115',
                                        color: hasLicenseIssues ? theme.colors.warning : '#10b981',
                                        cursor: hasLicenseIssues ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }, children: [hasLicenseIssues ? _jsx(Scale, { size: 12 }) : _jsx(Check, { size: 12 }), hasLicenseIssues ? `${licenseIssues} License Issues` : 'Licenses OK'] }));
                            })()] })] })), !analysisResults && (_jsxs("div", { children: [_jsx("button", { onClick: handleAnalyze, disabled: !selectedPackage || isAnalyzing, style: {
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: !selectedPackage || isAnalyzing
                                ? theme.colors.backgroundLight
                                : theme.colors.primary,
                            color: !selectedPackage || isAnalyzing
                                ? theme.colors.textSecondary
                                : '#fff',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: !selectedPackage || isAnalyzing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }, children: isAnalyzing ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { size: 14, className: "animate-spin" }), "Analyzing..."] })) : ('Analyze Dependencies') }), analysisStatus && (_jsxs("div", { style: {
                            marginTop: '8px',
                            padding: '8px',
                            borderRadius: '4px',
                            backgroundColor: theme.colors.backgroundLight,
                            fontSize: '12px',
                            color: theme.colors.textSecondary,
                            textAlign: 'center'
                        }, children: [analysisStatus, progress.total > 0 && (_jsx("div", { style: {
                                    marginTop: '4px',
                                    height: '4px',
                                    backgroundColor: theme.colors.backgroundSecondary,
                                    borderRadius: '2px',
                                    overflow: 'hidden'
                                }, children: _jsx("div", { style: {
                                        height: '100%',
                                        width: `${(progress.current / progress.total) * 100}%`,
                                        backgroundColor: theme.colors.primary,
                                        transition: 'width 0.3s'
                                    } }) }))] })), error && (_jsxs("div", { style: {
                            marginTop: '8px',
                            padding: '8px',
                            borderRadius: '4px',
                            backgroundColor: `${theme.colors.error}15`,
                            border: `1px solid ${theme.colors.error}30`,
                            fontSize: '12px',
                            color: theme.colors.error,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }, children: [_jsx(AlertCircle, { size: 14 }), error] }))] })), dependencyItems.length > 0 && (_jsxs("div", { style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    overflow: 'hidden'
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }, children: [!analysisResults && (_jsxs("div", { style: {
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'center',
                                    flexWrap: 'wrap'
                                }, children: [_jsx("span", { style: {
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary,
                                            fontWeight: 500
                                        }, children: "Quick Filters:" }), (() => {
                                        const criticalCount = dependencyItems.filter(dep => dep.vulnerabilities &&
                                            dep.vulnerabilities.some(v => v.severity === 'critical' || v.severity === 'high')).length;
                                        const hasCritical = criticalCount > 0;
                                        return (_jsxs("button", { onClick: () => {
                                                if (hasCritical) {
                                                    setSmartFilter(smartFilter === 'critical-security' ? 'none' : 'critical-security');
                                                    setFilterType('all');
                                                    setShowOutdatedOnly(false);
                                                    setShowVulnerableOnly(false);
                                                }
                                            }, style: {
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                borderRadius: '4px',
                                                border: `1px solid ${smartFilter === 'critical-security' ? theme.colors.error :
                                                    hasCritical ? theme.colors.error : '#10b981'}`,
                                                backgroundColor: smartFilter === 'critical-security' ? `${theme.colors.error}20` :
                                                    hasCritical ? `${theme.colors.error}15` : '#10b98115',
                                                color: smartFilter === 'critical-security' ? theme.colors.error :
                                                    hasCritical ? theme.colors.error : '#10b981',
                                                cursor: hasCritical ? 'pointer' : 'default',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }, children: [hasCritical ? _jsx(Shield, { size: 10 }) : _jsx(Check, { size: 10 }), "Critical Security ", hasCritical && `(${criticalCount})`] }));
                                    })(), (() => {
                                        const deprecatedCount = dependencyItems.filter(d => d.isDeprecated).length;
                                        const hasDeprecated = deprecatedCount > 0;
                                        return (_jsxs("button", { onClick: () => {
                                                if (hasDeprecated) {
                                                    setSmartFilter(smartFilter === 'deprecated' ? 'none' : 'deprecated');
                                                    setFilterType('all');
                                                    setShowOutdatedOnly(false);
                                                    setShowVulnerableOnly(false);
                                                }
                                            }, style: {
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                borderRadius: '4px',
                                                border: `1px solid ${smartFilter === 'deprecated' ? theme.colors.error :
                                                    hasDeprecated ? theme.colors.warning : '#10b981'}`,
                                                backgroundColor: smartFilter === 'deprecated' ? `${theme.colors.error}20` :
                                                    hasDeprecated ? `${theme.colors.warning}15` : '#10b98115',
                                                color: smartFilter === 'deprecated' ? theme.colors.error :
                                                    hasDeprecated ? theme.colors.warning : '#10b981',
                                                cursor: hasDeprecated ? 'pointer' : 'default',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }, children: [hasDeprecated ? _jsx(AlertCircle, { size: 10 }) : _jsx(Check, { size: 10 }), "Deprecated ", hasDeprecated && `(${deprecatedCount})`] }));
                                    })(), (() => {
                                        const safeUpdateCount = dependencyItems.filter(dep => dep.isOutdated && dep.updateType === 'patch').length;
                                        const hasSafeUpdates = safeUpdateCount > 0;
                                        return (_jsxs("button", { onClick: () => {
                                                if (hasSafeUpdates) {
                                                    setSmartFilter(smartFilter === 'safe-updates' ? 'none' : 'safe-updates');
                                                    setFilterType('all');
                                                    setShowOutdatedOnly(false);
                                                    setShowVulnerableOnly(false);
                                                }
                                            }, style: {
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                borderRadius: '4px',
                                                border: `1px solid ${smartFilter === 'safe-updates' ? '#10b981' :
                                                    hasSafeUpdates ? theme.colors.primary : '#10b981'}`,
                                                backgroundColor: smartFilter === 'safe-updates' ? '#10b98120' :
                                                    hasSafeUpdates ? `${theme.colors.primary}15` : '#10b98115',
                                                color: smartFilter === 'safe-updates' ? '#10b981' :
                                                    hasSafeUpdates ? theme.colors.primary : '#10b981',
                                                cursor: hasSafeUpdates ? 'pointer' : 'default',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }, children: [hasSafeUpdates ? _jsx(Zap, { size: 10 }) : _jsx(Check, { size: 10 }), "Safe Updates ", hasSafeUpdates && `(${safeUpdateCount})`] }));
                                    })(), (() => {
                                        const licenseIssues = dependencyItems.filter(dep => dep.licenseType === 'copyleft' || dep.licenseType === 'proprietary').length;
                                        const hasLicenseIssues = licenseIssues > 0;
                                        return (_jsxs("button", { onClick: () => {
                                                if (hasLicenseIssues) {
                                                    setSmartFilter(smartFilter === 'license-review' ? 'none' : 'license-review');
                                                    setFilterType('all');
                                                    setShowOutdatedOnly(false);
                                                    setShowVulnerableOnly(false);
                                                }
                                            }, style: {
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                borderRadius: '4px',
                                                border: `1px solid ${smartFilter === 'license-review' ? theme.colors.warning :
                                                    hasLicenseIssues ? theme.colors.warning : '#10b981'}`,
                                                backgroundColor: smartFilter === 'license-review' ? `${theme.colors.warning}20` :
                                                    hasLicenseIssues ? `${theme.colors.warning}15` : '#10b98115',
                                                color: smartFilter === 'license-review' ? theme.colors.warning :
                                                    hasLicenseIssues ? theme.colors.warning : '#10b981',
                                                cursor: hasLicenseIssues ? 'pointer' : 'default',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }, children: [hasLicenseIssues ? _jsx(Scale, { size: 10 }) : _jsx(Check, { size: 10 }), "License Review ", hasLicenseIssues && `(${licenseIssues})`] }));
                                    })(), (() => {
                                        const productionRiskCount = dependencyItems.filter(dep => dep.dependencyType === 'production' &&
                                            (dep.updateType === 'major' || (dep.vulnerabilities && dep.vulnerabilities.length > 0))).length;
                                        const hasProductionRisk = productionRiskCount > 0;
                                        return (_jsxs("button", { onClick: () => {
                                                if (hasProductionRisk) {
                                                    setSmartFilter(smartFilter === 'production-risk' ? 'none' : 'production-risk');
                                                    setFilterType('all');
                                                    setShowOutdatedOnly(false);
                                                    setShowVulnerableOnly(false);
                                                }
                                            }, style: {
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                borderRadius: '4px',
                                                border: `1px solid ${smartFilter === 'production-risk' ? theme.colors.error :
                                                    hasProductionRisk ? theme.colors.error : '#10b981'}`,
                                                backgroundColor: smartFilter === 'production-risk' ? `${theme.colors.error}20` :
                                                    hasProductionRisk ? `${theme.colors.error}15` : '#10b98115',
                                                color: smartFilter === 'production-risk' ? theme.colors.error :
                                                    hasProductionRisk ? theme.colors.error : '#10b981',
                                                cursor: hasProductionRisk ? 'pointer' : 'default',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }, children: [hasProductionRisk ? _jsx(AlertTriangle, { size: 10 }) : _jsx(Check, { size: 10 }), "Production Risk ", hasProductionRisk && `(${productionRiskCount})`] }));
                                    })(), smartFilter !== 'none' && (_jsx("button", { onClick: () => setSmartFilter('none'), style: {
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            borderRadius: '4px',
                                            border: `1px solid ${theme.colors.border}`,
                                            backgroundColor: theme.colors.backgroundLight,
                                            color: theme.colors.textSecondary,
                                            cursor: 'pointer'
                                        }, children: "Clear Filter" }))] })), _jsxs("div", { style: {
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    opacity: smartFilter !== 'none' ? 0.5 : 1,
                                    pointerEvents: smartFilter !== 'none' ? 'none' : 'auto'
                                }, children: [_jsx("div", { style: { display: 'flex', gap: '4px' }, children: ['all', 'production', 'development', 'peer'].map(type => (_jsxs("button", { onClick: () => setFilterType(type), style: {
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                borderRadius: '4px',
                                                border: `1px solid ${filterType === type ? theme.colors.primary : theme.colors.border}`,
                                                backgroundColor: filterType === type ? `${theme.colors.primary}20` : theme.colors.backgroundSecondary,
                                                color: filterType === type ? theme.colors.primary : theme.colors.text,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }, children: [type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1), type !== 'all' && (_jsxs("span", { style: { marginLeft: '4px', opacity: 0.7 }, children: ["(", dependencyItems.filter(d => d.dependencyType === type).length, ")"] }))] }, type))) }), _jsxs("button", { onClick: () => setShowOutdatedOnly(!showOutdatedOnly), style: {
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            borderRadius: '4px',
                                            border: `1px solid ${showOutdatedOnly ? theme.colors.warning : theme.colors.border}`,
                                            backgroundColor: showOutdatedOnly ? `${theme.colors.warning}20` : theme.colors.backgroundSecondary,
                                            color: showOutdatedOnly ? theme.colors.warning : theme.colors.text,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }, children: [_jsx(Filter, { size: 10 }), "Outdated Only (", dependencyItems.filter(d => d.isOutdated).length, ")"] }), _jsxs("button", { onClick: () => setShowVulnerableOnly(!showVulnerableOnly), style: {
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            borderRadius: '4px',
                                            border: `1px solid ${showVulnerableOnly ? theme.colors.error : theme.colors.border}`,
                                            backgroundColor: showVulnerableOnly ? `${theme.colors.error}20` : theme.colors.backgroundSecondary,
                                            color: showVulnerableOnly ? theme.colors.error : theme.colors.text,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }, children: [_jsx(AlertTriangle, { size: 10 }), "Vulnerable (", dependencyItems.filter(d => d.vulnerabilities && d.vulnerabilities.length > 0).length, ")"] }), _jsxs("div", { style: {
                                            marginLeft: 'auto',
                                            fontSize: '11px',
                                            color: theme.colors.textSecondary
                                        }, children: ["Showing ", filteredDependencies.length, " of ", dependencyItems.length, " dependencies"] })] }), selectedDependencies.size > 0 && (_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    backgroundColor: `${theme.colors.primary}10`,
                                    borderRadius: '6px',
                                    border: `1px solid ${theme.colors.primary}30`
                                }, children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }, children: [_jsxs("span", { style: {
                                                    fontSize: '12px',
                                                    color: theme.colors.text,
                                                    fontWeight: 500
                                                }, children: [selectedDependencies.size, " selected"] }), _jsx("button", { onClick: clearSelection, style: {
                                                    padding: '4px 8px',
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    borderRadius: '4px',
                                                    border: `1px solid ${theme.colors.border}`,
                                                    backgroundColor: theme.colors.background,
                                                    color: theme.colors.textSecondary,
                                                    cursor: 'pointer'
                                                }, children: "Clear" })] }), _jsxs("button", { onClick: generateUpdatePrompt, style: {
                                            padding: '6px 12px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            borderRadius: '4px',
                                            border: 'none',
                                            backgroundColor: theme.colors.primary,
                                            color: '#fff',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }, children: [_jsx(Copy, { size: 14 }), "Copy Update Prompt"] })] })), filteredDependencies.filter(d => d.isOutdated).length > 0 && selectedDependencies.size === 0 && (_jsx("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }, children: _jsxs("button", { onClick: selectAllOutdated, style: {
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        borderRadius: '4px',
                                        border: `1px solid ${theme.colors.primary}`,
                                        backgroundColor: `${theme.colors.primary}10`,
                                        color: theme.colors.primary,
                                        cursor: 'pointer'
                                    }, children: ["Select All Outdated (", filteredDependencies.filter(d => d.isOutdated).length, ")"] }) })), showUpdatePrompt && (_jsxs("div", { style: {
                                    position: 'fixed',
                                    top: '20px',
                                    right: '20px',
                                    padding: '12px 16px',
                                    backgroundColor: '#10b981',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }, children: [_jsx(Check, { size: 16 }), "Update prompt copied to clipboard"] }))] }), _jsx("div", { style: {
                            flex: 1,
                            overflow: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '4px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '6px',
                            border: `1px solid ${theme.colors.border}`
                        }, children: filteredDependencies.map(dep => {
                            const depKey = `${dep.name}-${dep.dependencyType}`;
                            const isSelected = selectedDependencies.has(depKey);
                            return (_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    backgroundColor: isSelected ? `${theme.colors.primary}10` : theme.colors.background,
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                                    transition: 'all 0.2s',
                                    cursor: dep.isOutdated ? 'pointer' : 'default'
                                }, onClick: () => {
                                    if (dep.isOutdated) {
                                        toggleDependencySelection(depKey);
                                    }
                                }, onMouseEnter: (e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.backgroundColor = theme.colors.backgroundLight;
                                        e.currentTarget.style.borderColor = theme.colors.primary;
                                    }
                                }, onMouseLeave: (e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.backgroundColor = theme.colors.background;
                                        e.currentTarget.style.borderColor = theme.colors.border;
                                    }
                                }, children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            flex: 1,
                                            minWidth: 0
                                        }, children: [dep.isOutdated && (_jsx("div", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    toggleDependencySelection(depKey);
                                                }, style: {
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '20px',
                                                    height: '20px'
                                                }, children: isSelected ? (_jsx(CheckCircle2, { size: 18, color: theme.colors.primary, fill: `${theme.colors.primary}20` })) : (_jsx(Circle, { size: 18, color: theme.colors.textSecondary, style: { opacity: 0.5 } })) })), _jsx("span", { style: {
                                                    fontWeight: 500,
                                                    color: dep.isOutdated ? theme.colors.text : '#10b981',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }, children: dep.name }), _jsx("span", { style: getDependencyTypeBadgeStyle(dep.dependencyType), children: dep.dependencyType === 'production' ? 'prod' : dep.dependencyType === 'development' ? 'dev' : 'peer' })] }), _jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: dep.currentVersion }), dep.isOutdated && dep.latestVersion && (_jsxs(_Fragment, { children: [_jsx("span", { style: { color: theme.colors.textSecondary }, children: "\u2192" }), _jsx("span", { style: {
                                                                    fontWeight: 500,
                                                                    color: dep.updateType === 'major' ? theme.colors.error :
                                                                        dep.updateType === 'minor' ? theme.colors.warning :
                                                                            '#10b981'
                                                                }, children: dep.latestVersion }), _jsx("span", { style: getUpdateBadgeStyle(dep.updateType), children: dep.updateType })] }))] }), dep.vulnerabilities && dep.vulnerabilities.length > 0 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(AlertTriangle, { size: 12, color: theme.colors.error }), _jsx("span", { style: { fontSize: '11px', color: theme.colors.error }, children: dep.vulnerabilities.length }), (() => {
                                                        // Find highest severity
                                                        const severities = ['critical', 'high', 'moderate', 'low'];
                                                        const highestSeverity = dep.vulnerabilities.reduce((highest, vuln) => {
                                                            const currentIndex = severities.indexOf(vuln.severity);
                                                            const highestIndex = severities.indexOf(highest);
                                                            return currentIndex < highestIndex ? vuln.severity : highest;
                                                        }, 'low');
                                                        return (_jsx("span", { style: getSeverityBadgeStyle(highestSeverity), children: highestSeverity }));
                                                    })()] })), dep.isDeprecated && (_jsx("span", { style: {
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: 500,
                                                    backgroundColor: `${theme.colors.error}20`,
                                                    color: theme.colors.error
                                                }, children: "deprecated" })), dep.license && (_jsx("span", { style: getLicenseBadgeStyle(dep.licenseType), children: dep.license })), _jsx("a", { href: `https://www.npmjs.com/package/${dep.name}`, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), style: {
                                                    padding: '4px',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    transition: 'background-color 0.2s'
                                                }, onMouseEnter: (e) => {
                                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundLight;
                                                }, onMouseLeave: (e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                }, title: "View on npm", children: _jsx(ExternalLink, { size: 12, color: theme.colors.textSecondary }) })] })] }, depKey));
                        }) })] })), _jsx("style", { children: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      ` }), _jsx(DependencyInfoModal, { isOpen: showInfoModal, onClose: () => setShowInfoModal(false) })] }));
};

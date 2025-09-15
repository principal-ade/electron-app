/**
 * Main process service for collecting test coverage using Jest
 *
 * This runs in the main process where we have access to Node.js APIs
 * and can spawn Jest with coverage collection.
 */
import * as path from 'path';
import * as fs from 'fs';
import { electronCLI } from '../electron-cli-bridge';
export class TestCoverageService {
    cliInitialized = false;
    /**
     * Initialize the electron-cli-bridge
     */
    async ensureCLIInitialized() {
        if (!this.cliInitialized) {
            await electronCLI.initialize();
            this.cliInitialized = true;
        }
    }
    /**
     * Collect test coverage for packages in a repository
     */
    async collectCoverage(rootPath, packages, options = {}) {
        const startTime = Date.now();
        const packageResults = [];
        const opts = {
            watchMode: false,
            updateSnapshot: false,
            bail: false,
            maxWorkers: 2,
            ...options
        };
        let totalTestsPassed = 0;
        let totalTestsFailed = 0;
        let totalTestsSkipped = 0;
        // Process each package
        for (const pkg of packages) {
            // Handle special cases for root package
            let relativePath = pkg.path;
            if (!relativePath || relativePath === '.' || relativePath === 'package.json') {
                relativePath = '.';
            }
            const packagePath = path.isAbsolute(pkg.path)
                ? pkg.path
                : path.join(rootPath, relativePath);
            console.log(`[TestCoverageService] Processing package ${pkg.name}: ${pkg.path} -> ${packagePath}`);
            try {
                const coverageData = await this.runJestWithCoverage(packagePath, pkg.name, opts);
                if (coverageData) {
                    packageResults.push(coverageData);
                    totalTestsPassed += coverageData.testsPassed;
                    totalTestsFailed += coverageData.testsFailed;
                    totalTestsSkipped += coverageData.testsSkipped;
                }
            }
            catch (error) {
                console.error(`Failed to collect coverage for package ${pkg.name}:`, error);
            }
        }
        // Calculate overall coverage
        const overallCoverage = this.calculateOverallCoverage(packageResults);
        return {
            timestamp: Date.now(),
            rootPath,
            packages: packageResults,
            totalPackages: packageResults.length,
            totalFiles: packageResults.reduce((sum, pkg) => sum + pkg.fileCoverage.size, 0),
            overallCoverage,
            testSummary: {
                passed: totalTestsPassed,
                failed: totalTestsFailed,
                skipped: totalTestsSkipped,
                total: totalTestsPassed + totalTestsFailed + totalTestsSkipped
            },
            collectionTime: Date.now() - startTime
        };
    }
    /**
     * Run Jest with coverage for a specific package
     */
    async runJestWithCoverage(packagePath, packageName, options) {
        console.log(`[TestCoverageService] Running Jest for package: ${packageName} at ${packagePath}`);
        const jestConfigPath = path.join(packagePath, 'jest.config.js');
        const jestConfigMjsPath = path.join(packagePath, 'jest.config.mjs');
        const jestConfigJsonPath = path.join(packagePath, 'jest.config.json');
        const packageJsonPath = path.join(packagePath, 'package.json');
        // Check if Jest is configured
        const hasJestConfig = fs.existsSync(jestConfigPath) ||
            fs.existsSync(jestConfigMjsPath) ||
            fs.existsSync(jestConfigJsonPath);
        // Check if package.json exists and has jest config
        let hasJestInPackageJson = false;
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                hasJestInPackageJson = !!(packageJson.jest ||
                    packageJson.scripts?.test?.includes('jest') ||
                    packageJson.devDependencies?.jest ||
                    packageJson.dependencies?.jest);
            }
            catch (e) {
                console.error(`[TestCoverageService] Failed to parse package.json at ${packageJsonPath}:`, e);
            }
        }
        if (!hasJestConfig && !hasJestInPackageJson) {
            console.log(`[TestCoverageService] No Jest configuration found for ${packageName} at ${packagePath}`);
            console.log(`[TestCoverageService] Checked paths:`, {
                jestConfigPath,
                jestConfigMjsPath,
                jestConfigJsonPath,
                packageJsonPath,
                exists: {
                    jestConfig: fs.existsSync(jestConfigPath),
                    jestConfigMjs: fs.existsSync(jestConfigMjsPath),
                    jestConfigJson: fs.existsSync(jestConfigJsonPath),
                    packageJson: fs.existsSync(packageJsonPath)
                }
            });
            return null;
        }
        // Check if there's a test:coverage script
        let useTestCoverageScript = false;
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                if (packageJson.scripts?.['test:coverage']) {
                    useTestCoverageScript = true;
                    console.log(`[TestCoverageService] Found test:coverage script for ${packageName}`);
                }
            }
            catch (e) {
                console.error(`[TestCoverageService] Failed to check scripts in package.json:`, e);
            }
        }
        // Build Jest command arguments - simpler approach, just run coverage
        let args;
        if (useTestCoverageScript) {
            // Use the existing test:coverage script with coverage threshold override and force exit
            args = ['run', 'test:coverage', '--', '--coverageThreshold={}', '--forceExit'];
        }
        else {
            // Run Jest directly with coverage
            args = ['test', '--', '--coverage', '--coverageThreshold={}', '--forceExit'];
            // Always disable watch mode in CI environment
            if (!options.watchMode) {
                args.push('--watchAll=false');
            }
        }
        if (options.updateSnapshot) {
            args.push('--updateSnapshot');
        }
        if (options.bail) {
            args.push('--bail');
        }
        if (options.maxWorkers) {
            args.push(`--maxWorkers=${options.maxWorkers}`);
        }
        // Log the command being run
        console.log(`[TestCoverageService] Running command: npm ${args.join(' ')}`);
        console.log(`[TestCoverageService] Working directory: ${packagePath}`);
        // Ensure CLI is initialized
        await this.ensureCLIInitialized();
        // Clean environment to avoid Node.js conflicts with Electron
        const cleanEnv = { ...process.env };
        delete cleanEnv.NODE_OPTIONS;
        delete cleanEnv.NODE_ENV;
        cleanEnv.CI = 'true'; // Set CI mode to avoid interactive mode
        // Execute Jest using electron-cli-bridge
        const result = await electronCLI.npm(args, {
            cwd: packagePath,
            env: Object.fromEntries(Object.entries(cleanEnv).filter(([_, v]) => v !== undefined)),
            timeout: 60000 // 60 second timeout
        });
        const stdout = result.stdout;
        const stderr = result.stderr;
        const code = result.exitCode;
        console.log(`[TestCoverageService] Jest process exited with code ${code}`);
        if (code !== 0) {
            console.log(`[TestCoverageService] Jest stderr: ${stderr.substring(0, 500)}`);
        }
        // Try to read coverage data even if tests failed
        const coveragePath = path.join(packagePath, 'coverage', 'coverage-final.json');
        const coverageSummaryPath = path.join(packagePath, 'coverage', 'coverage-summary.json');
        // const resultsPath = path.join(packagePath, 'jest-results.json'); // Future use
        try {
            let fileCoverage = new Map();
            let testsPassed = 0;
            let testsFailed = 0;
            let testsSkipped = 0;
            // Parse test results from stdout if available
            // Look for the summary line like "Tests:       9 failed, 281 passed, 290 total"
            const testSummaryMatch = stdout.match(/Tests:\s+(?:(\d+)\s+failed,\s*)?(\d+)\s+passed(?:,\s*(\d+)\s+skipped)?.*?(\d+)\s+total/);
            if (testSummaryMatch) {
                testsFailed = parseInt(testSummaryMatch[1]) || 0;
                testsPassed = parseInt(testSummaryMatch[2]) || 0;
                testsSkipped = parseInt(testSummaryMatch[3]) || 0;
                const total = parseInt(testSummaryMatch[4]) || 0;
                console.log(`[TestCoverageService] Test results - Passed: ${testsPassed}, Failed: ${testsFailed}, Skipped: ${testsSkipped}, Total: ${total}`);
            }
            else {
                // Try alternative formats
                const passedMatch = stdout.match(/(\d+)\s+passed/);
                const failedMatch = stdout.match(/(\d+)\s+failed/);
                const skippedMatch = stdout.match(/(\d+)\s+skipped/);
                if (passedMatch)
                    testsPassed = parseInt(passedMatch[1]) || 0;
                if (failedMatch)
                    testsFailed = parseInt(failedMatch[1]) || 0;
                if (skippedMatch)
                    testsSkipped = parseInt(skippedMatch[1]) || 0;
                if (passedMatch || failedMatch) {
                    console.log(`[TestCoverageService] Test results (alt) - Passed: ${testsPassed}, Failed: ${testsFailed}, Skipped: ${testsSkipped}`);
                }
            }
            // Check what coverage files exist
            console.log(`[TestCoverageService] Checking coverage files:`);
            console.log(`  coverage-final.json exists: ${fs.existsSync(coveragePath)}`);
            console.log(`  coverage-summary.json exists: ${fs.existsSync(coverageSummaryPath)}`);
            // Read coverage data
            if (fs.existsSync(coveragePath)) {
                const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
                console.log(`[TestCoverageService] Found coverage data for ${Object.keys(coverageData).length} files`);
                for (const [filePath, coverage] of Object.entries(coverageData)) {
                    const relativePath = path.relative(packagePath, filePath);
                    // Calculate coverage percentages
                    const statements = Object.values(coverage.s);
                    const functions = Object.values(coverage.f);
                    const branches = Object.values(coverage.b).flat();
                    const statementCoverage = this.calculatePercentage(statements.filter(c => c > 0).length, statements.length);
                    const functionCoverage = this.calculatePercentage(functions.filter(c => c > 0).length, functions.length);
                    const branchCoverage = this.calculatePercentage(branches.filter(c => c > 0).length, branches.length);
                    // Find uncovered lines
                    const uncoveredLines = [];
                    Object.entries(coverage.s).forEach(([key, count]) => {
                        if (count === 0 && coverage.statementMap[key]) {
                            const line = coverage.statementMap[key].start.line;
                            if (!uncoveredLines.includes(line)) {
                                uncoveredLines.push(line);
                            }
                        }
                    });
                    fileCoverage.set(relativePath, {
                        path: filePath,
                        relativePath,
                        statementCoverage,
                        branchCoverage,
                        functionCoverage,
                        lineCoverage: statementCoverage, // Jest uses statement coverage for lines
                        uncoveredLines: uncoveredLines.sort((a, b) => a - b)
                    });
                }
            }
            else {
                console.log(`[TestCoverageService] No coverage data found at ${coveragePath}`);
            }
            // Calculate package totals - return results even if no coverage data
            const packageCoverage = this.calculatePackageTotals(packageName, packagePath, fileCoverage, testsPassed, testsFailed, testsSkipped);
            return packageCoverage;
        }
        catch (error) {
            console.error(`Failed to parse coverage data for ${packageName}:`, error);
            // Return partial results with test counts even on error
            return {
                packageName,
                packagePath,
                fileCoverage: new Map(),
                totalStatements: 0,
                coveredStatements: 0,
                totalBranches: 0,
                coveredBranches: 0,
                totalFunctions: 0,
                coveredFunctions: 0,
                totalLines: 0,
                coveredLines: 0,
                testsPassed: 0,
                testsFailed: 0,
                testsSkipped: 0
            };
        }
    }
    /**
     * Calculate coverage percentage
     */
    calculatePercentage(covered, total) {
        if (total === 0)
            return 100;
        return Math.round((covered / total) * 100);
    }
    /**
     * Calculate package-level coverage totals
     */
    calculatePackageTotals(packageName, packagePath, fileCoverage, testsPassed, testsFailed, testsSkipped) {
        let totalStatements = 0;
        let coveredStatements = 0;
        let totalBranches = 0;
        let coveredBranches = 0;
        let totalFunctions = 0;
        let coveredFunctions = 0;
        let totalLines = 0;
        let coveredLines = 0;
        // Aggregate file coverage
        for (const file of fileCoverage.values()) {
            // These are percentages, so we need to estimate counts
            // This is a simplification - ideally we'd have raw counts from Jest
            const fileSize = 100; // Assume 100 items per metric for averaging
            totalStatements += fileSize;
            coveredStatements += Math.round(fileSize * file.statementCoverage / 100);
            totalBranches += fileSize;
            coveredBranches += Math.round(fileSize * file.branchCoverage / 100);
            totalFunctions += fileSize;
            coveredFunctions += Math.round(fileSize * file.functionCoverage / 100);
            totalLines += fileSize;
            coveredLines += Math.round(fileSize * file.lineCoverage / 100);
        }
        return {
            packageName,
            packagePath,
            fileCoverage,
            totalStatements,
            coveredStatements,
            totalBranches,
            coveredBranches,
            totalFunctions,
            coveredFunctions,
            totalLines,
            coveredLines,
            testsPassed,
            testsFailed,
            testsSkipped
        };
    }
    /**
     * Calculate overall coverage across all packages
     */
    calculateOverallCoverage(packages) {
        let totalStatements = 0;
        let coveredStatements = 0;
        let totalBranches = 0;
        let coveredBranches = 0;
        let totalFunctions = 0;
        let coveredFunctions = 0;
        let totalLines = 0;
        let coveredLines = 0;
        for (const pkg of packages) {
            totalStatements += pkg.totalStatements;
            coveredStatements += pkg.coveredStatements;
            totalBranches += pkg.totalBranches;
            coveredBranches += pkg.coveredBranches;
            totalFunctions += pkg.totalFunctions;
            coveredFunctions += pkg.coveredFunctions;
            totalLines += pkg.totalLines;
            coveredLines += pkg.coveredLines;
        }
        return {
            statements: this.calculatePercentage(coveredStatements, totalStatements),
            branches: this.calculatePercentage(coveredBranches, totalBranches),
            functions: this.calculatePercentage(coveredFunctions, totalFunctions),
            lines: this.calculatePercentage(coveredLines, totalLines)
        };
    }
    /**
     * Cancel running coverage collection for a package
     * Note: With electron-cli-bridge, processes run synchronously so cancellation
     * is not currently supported. This method is kept for API compatibility.
     */
    cancelCoverage(packageName) {
        console.warn('[TestCoverageService] Process cancellation not supported with electron-cli-bridge');
    }
    /**
     * Cancel all running coverage collections
     * Note: With electron-cli-bridge, processes run synchronously so cancellation
     * is not currently supported. This method is kept for API compatibility.
     */
    cancelAllCoverage() {
        console.warn('[TestCoverageService] Process cancellation not supported with electron-cli-bridge');
    }
}
// Export singleton instance
export const testCoverageService = new TestCoverageService();

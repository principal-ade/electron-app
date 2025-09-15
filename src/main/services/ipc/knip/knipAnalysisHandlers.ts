import { ipcMain } from 'electron';
import { dockerService } from '../../../docker/dockerService';
import { OptimizedDockerService } from '../../../docker/OptimizedDockerService';
import { KnipConfigGenerator } from '../../knip/KnipConfigGenerator';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { electronCLI } from '../../../electron-cli-bridge';

// Helper to ensure CLI is initialized
let cliInitialized = false;
async function ensureCLIInitialized() {
  if (!cliInitialized) {
    await electronCLI.initialize();
    cliInitialized = true;
  }
}

interface KnipAnalysisRequest {
  path: string;
  isRemote: boolean;
  url?: string;
  packageName?: string;
  packagePath?: string;
  forceRefresh?: boolean;
}

interface KnipAnalysisResult {
  files: string[];
  issues: Array<{
    file: string;
    type: string;
    symbol?: string;
    severity?: string;
  }>;
  dependencies: {
    unused: string[];
    unlisted: string[];
  };
  exports: {
    unused: Array<{
      file: string;
      symbols: string[];
    }>;
  };
  summary?: {
    totalFiles: number;
    totalIssues: number;
    unusedFiles: number;
    unusedExports: number;
    unusedDependencies: number;
  };
}

// Cache for analysis results (in-memory for now)
const analysisCache = new Map<string, {
  result: KnipAnalysisResult;
  timestamp: number;
}>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function registerKnipAnalysisHandlers() {
  ipcMain.handle('knip:analyze-repository', async (event, request: KnipAnalysisRequest) => {
    let tempDir: string | null = null;
    
    try {
      // Check cache first (unless force refresh is requested)
      const cacheKey = request.isRemote ? request.url || request.path : request.path;
      
      if (!request.forceRefresh) {
        const cached = analysisCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log('[Knip] Using cached analysis results');
          return { success: true, data: cached.result };
        }
      } else {
        console.log('[Knip] Force refresh requested, bypassing cache');
        // Clear the cache entry if force refresh is requested
        analysisCache.delete(cacheKey);
      }

      // For local repositories, ONLY try local execution
      if (!request.isRemote && request.path) {
        const hasKnipConfig = await checkForKnipConfig(request.path, request.packagePath);
        if (!hasKnipConfig) {
          const targetPath = request.packagePath 
            ? path.join(request.path, request.packagePath) 
            : request.path;
          return {
            success: false,
            error: `No Knip configuration found in ${targetPath}. Please add a knip.json, knip.config.js, or configure knip in package.json to use local analysis.`
          };
        }
        
        console.log('[Knip] Found Knip config, attempting local execution');
        const localResult = await tryLocalKnipExecution(request, event);
        if (localResult) {
          // Cache the results
          analysisCache.set(cacheKey, {
            result: localResult,
            timestamp: Date.now(),
          });
          return { success: true, data: localResult };
        }
        
        // If local execution failed, return the error - do NOT fall back to Docker
        return {
          success: false,
          error: 'Local Knip execution failed. Please ensure Knip is installed locally (npm install -g knip) and your configuration is valid.'
        };
      }

      // Check Docker status using the optimized service
      try {
        const optimizedDockerService = await OptimizedDockerService.getInstance();
        await optimizedDockerService.initialize();
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Docker is not available. Please ensure Docker Desktop is installed and running.' 
        };
      }

      // Prepare repository path
      let repoPath = request.path;

      console.log('[Knip] Analysis request:', {
        path: request.path,
        isRemote: request.isRemote,
        url: request.url,
        packageName: request.packageName,
        packagePath: request.packagePath
      });

      if (request.isRemote && request.url) {
        // Send progress update for cloning
        event.sender.send('knip:analysis-progress', {
          message: 'Cloning repository from GitHub...',
          percent: 10
        });
        
        // Clone remote repository to temp directory with progress callback
        tempDir = await cloneRemoteRepository(request.url, (message) => {
          event.sender.send('knip:analysis-progress', {
            message,
            percent: 15
          });
        });
        
        if (!tempDir) {
          return { 
            success: false, 
            error: 'Failed to clone remote repository. The repository may be too large or require authentication.' 
          };
        }
        // If there's a package path, append it to the temp directory
        if (request.packagePath) {
          repoPath = path.join(tempDir, request.packagePath);
        } else {
          repoPath = tempDir;
        }
      } else {
        // For local repositories, also append the package path if provided
        if (request.packagePath) {
          repoPath = path.join(request.path, request.packagePath);
        }
      }

      console.log('[Knip] Using repository path:', repoPath);

      // Send progress updates
      const packageInfo = request.packageName ? ` for package "${request.packageName}"` : '';
      event.sender.send('knip:analysis-progress', {
        message: `Preparing analysis environment${packageInfo}...`,
        percent: 20
      });

      // Check if the repository has a package.json
      const packageJsonPath = path.join(repoPath, 'package.json');
      console.log('[Knip] Checking for package.json at:', packageJsonPath);
      
      const hasPackageJson = await fileExists(packageJsonPath);
      console.log('[Knip] package.json exists:', hasPackageJson);
      
      // If no package.json, list what files are in the directory
      if (!hasPackageJson) {
        try {
          const files = await fs.readdir(repoPath);
          console.log('[Knip] Files in directory:', files.slice(0, 20)); // Log first 20 files
          
          // Check if there are subdirectories with package.json
          const subDirs = [];
          for (const file of files) {
            const filePath = path.join(repoPath, file);
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
              const subPackageJson = path.join(filePath, 'package.json');
              if (await fileExists(subPackageJson)) {
                subDirs.push(file);
              }
            }
          }
          
          if (subDirs.length > 0) {
            console.log('[Knip] Found package.json in subdirectories:', subDirs);
            // Clean up temp directory if used
            if (tempDir) {
              await cleanupTempDirectory(tempDir);
            }
            return {
              success: false,
              error: `No package.json found in ${repoPath}. Found package.json in subdirectories: ${subDirs.join(', ')}. Please select a specific package to analyze.`
            };
          }
        } catch (err) {
          console.error('[Knip] Error listing directory:', err);
        }
        
        // Clean up temp directory if used
        if (tempDir) {
          await cleanupTempDirectory(tempDir);
        }
        return {
          success: false,
          error: `No package.json found at ${packageJsonPath}. Knip requires a Node.js/TypeScript project. Path checked: ${repoPath}`
        };
      }

      // Send progress update
      event.sender.send('knip:analysis-progress', {
        message: `Running Knip analysis${packageInfo}...`,
        percent: 40
      });

      // Check if knip.json exists, if not generate one
      const knipConfigPath = path.join(repoPath, 'knip.json');
      let generatedConfig = false;
      
      if (!await fileExists(knipConfigPath)) {
        console.log('[Knip] No knip.json found, generating config...');
        try {
          const autoConfig = await KnipConfigGenerator.generateConfig(repoPath);
          await KnipConfigGenerator.writeConfigToTemp(autoConfig, repoPath);
          generatedConfig = true;
          console.log('[Knip] Generated config:', autoConfig);
        } catch (err) {
          console.error('[Knip] Failed to generate config:', err);
        }
      }

      // Run Knip analysis using the optimized Docker service
      console.log('[Knip] Running analysis on:', repoPath);
      
      const knipOptions: any = {
        reporter: 'json',
      };
      
      // Use generated config if we created one
      if (generatedConfig) {
        knipOptions.config = 'knip.generated.json';
      }
      
      // Use the optimized Docker service
      const optimizedDockerService = await OptimizedDockerService.getInstance();
      const analysisSession = await optimizedDockerService.runAnalysis('knip', repoPath, knipOptions);
      
      // Extract results from the session
      const knipResult = analysisSession.results || (analysisSession.output ? { stdout: analysisSession.output.stdout } : null);
      
      if (!knipResult) {
        throw new Error(analysisSession.error || 'Analysis failed with no results');
      }

      // Send progress update
      event.sender.send('knip:analysis-progress', {
        message: 'Processing results...',
        percent: 80
      });

      // Parse and process results
      let analysisResult: KnipAnalysisResult;
      
      if (typeof knipResult === 'object' && !knipResult.stdout) {
        // Direct JSON result
        analysisResult = parseKnipResults(knipResult);
      } else if (knipResult.stdout) {
        // Parse from stdout
        try {
          // First try to extract clean JSON
          const jsonOutput = extractJsonFromOutput(knipResult.stdout);
          analysisResult = parseKnipResults(JSON.parse(jsonOutput));
        } catch (error) {
          console.error('[Knip] Failed to parse JSON output:', error);
          console.log('[Knip] Raw output (first 500 chars):', knipResult.stdout.substring(0, 500));
          
          // Try to parse as text output
          try {
            analysisResult = parseKnipTextOutput(knipResult.stdout);
            console.log('[Knip] Parsed text output successfully');
          } catch (textError) {
            console.error('[Knip] Failed to parse text output:', textError);
            // Return empty result rather than failing completely
            analysisResult = {
              files: [],
              issues: [],
              dependencies: { unused: [], unlisted: [] },
              exports: { unused: [] },
            };
          }
        }
      } else {
        console.log('[Knip] No output received from Knip');
        analysisResult = {
          files: [],
          issues: [],
          dependencies: { unused: [], unlisted: [] },
          exports: { unused: [] },
        };
      }

      // Add summary
      analysisResult.summary = {
        totalFiles: analysisResult.files.length,
        totalIssues: analysisResult.issues.length,
        unusedFiles: analysisResult.files.length,
        unusedExports: analysisResult.exports.unused.reduce((sum, e) => sum + e.symbols.length, 0),
        unusedDependencies: analysisResult.dependencies.unused.length,
      };

      console.log('[Knip] Analysis complete. Summary:', analysisResult.summary);
      if (analysisResult.files.length > 0) {
        console.log('[Knip] Sample unused files:', analysisResult.files.slice(0, 5));
      }
      if (analysisResult.exports.unused.length > 0) {
        console.log('[Knip] Sample unused exports:', analysisResult.exports.unused.slice(0, 3));
      }

      // Ensure the result is fully serializable by stripping any non-serializable properties
      const serializableResult = JSON.parse(JSON.stringify(analysisResult));

      // Cache the results
      analysisCache.set(cacheKey, {
        result: serializableResult,
        timestamp: Date.now(),
      });

      // Clean up temp directory if used
      if (tempDir) {
        await cleanupTempDirectory(tempDir);
      }

      // Send completion
      event.sender.send('knip:analysis-progress', {
        message: 'Analysis complete',
        percent: 100
      });

      return { success: true, data: serializableResult };
    } catch (error) {
      console.error('[Knip] Analysis error:', error);
      
      // Ensure we only return serializable data
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
          ? error 
          : 'Unknown error occurred during analysis';
      
      // Clean up temp directory if it exists
      if (tempDir) {
        try {
          await cleanupTempDirectory(tempDir);
        } catch (cleanupError) {
          console.error('[Knip] Failed to cleanup temp directory:', cleanupError);
        }
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  });

  // Clear cache handler
  ipcMain.handle('knip:clear-cache', async () => {
    analysisCache.clear();
    return { success: true };
  });
}

/**
 * Clone a remote repository to a temporary directory
 */
async function cloneRemoteRepository(url: string, progressCallback?: (message: string) => void): Promise<string | null> {
  try {
    const tempDir = path.join(os.tmpdir(), `knip-analysis-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    console.log(`[Knip] Cloning repository ${url} to ${tempDir}`);
    progressCallback?.('Cloning repository from GitHub...');
    
    // For private repos, we might need authentication
    // Try using gh CLI if available, otherwise fall back to git
    let cloneSuccess = false;
    
    // First try with gh CLI (handles auth automatically)
    try {
      await ensureCLIInitialized();
      const result = await electronCLI.execute('gh', ['repo', 'clone', url, tempDir, '--', '--depth', '1'], {
        timeout: 180000, // 3 minute timeout for larger repos
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      const { stdout, stderr } = result;
      console.log('[Knip] Clone with gh complete');
      cloneSuccess = true;
    } catch (ghError) {
      console.log('[Knip] gh clone failed, trying git:', ghError);
      
      // Fall back to regular git clone
      try {
        await ensureCLIInitialized();
        const cloneResult = await electronCLI.git.clone(url, tempDir, { depth: 1 });
        const stdout = cloneResult ? 'Clone successful' : '';
        const stderr = '';
        console.log('[Knip] Clone with git complete');
        cloneSuccess = true;
      } catch (gitError) {
        console.error('[Knip] Git clone also failed:', gitError);
        throw gitError;
      }
    }

    if (cloneSuccess) {
      progressCallback?.('Repository cloned successfully');
      return tempDir;
    }
    
    return null;
  } catch (error) {
    console.error('[Knip] Failed to clone repository:', error);
    return null;
  }
}

/**
 * Clean up temporary directory
 */
async function cleanupTempDirectory(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
    console.log('[Knip] Cleaned up temp directory:', dir);
  } catch (error) {
    console.error('[Knip] Failed to clean up temp directory:', error);
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract JSON from potentially mixed output
 */
function extractJsonFromOutput(output: string): string {
  // Remove any npm install output lines (they typically start with 'added', 'found', 'audited', etc.)
  const lines = output.split('\n');
  const cleanedLines = lines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith('added ') && 
           !trimmed.startsWith('found ') && 
           !trimmed.startsWith('audited ') &&
           !trimmed.startsWith('npm ') &&
           !trimmed.startsWith('up to date') &&
           trimmed.length > 0;
  });
  const cleanedOutput = cleanedLines.join('\n');
  
  // Look for JSON object
  const jsonMatch = cleanedOutput.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  // Try to find array format
  const arrayMatch = cleanedOutput.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }
  
  // If no JSON found, return the cleaned output
  return cleanedOutput;
}

/**
 * Parse Knip JSON results into our format
 */
function parseKnipResults(rawResults: any): KnipAnalysisResult {
  const result: KnipAnalysisResult = {
    files: [],
    issues: [],
    dependencies: { unused: [], unlisted: [] },
    exports: { unused: [] },
  };

  // Handle different Knip output formats
  if (Array.isArray(rawResults)) {
    // Array format (list of issues)
    for (const issue of rawResults) {
      if (issue.type === 'files' || issue.type === 'unresolved') {
        result.files.push(issue.file || issue.path);
      } else if (issue.type === 'exports') {
        const existing = result.exports.unused.find(e => e.file === issue.file);
        if (existing) {
          existing.symbols.push(issue.symbol || 'default');
        } else {
          result.exports.unused.push({
            file: issue.file,
            symbols: [issue.symbol || 'default']
          });
        }
      } else if (issue.type === 'dependencies' || issue.type === 'devDependencies') {
        if (issue.symbol && !result.dependencies.unused.includes(issue.symbol)) {
          result.dependencies.unused.push(issue.symbol);
        }
      } else if (issue.type === 'unlisted') {
        if (issue.symbol && !result.dependencies.unlisted.includes(issue.symbol)) {
          result.dependencies.unlisted.push(issue.symbol);
        }
      }
      
      result.issues.push({
        file: issue.file || issue.path || '',
        type: issue.type,
        symbol: issue.symbol,
        severity: issue.severity || 'warning'
      });
    }
  } else if (typeof rawResults === 'object') {
    // Object format (categorized results)
    if (rawResults.files) {
      result.files = Array.isArray(rawResults.files) 
        ? rawResults.files 
        : Object.keys(rawResults.files);
    }
    
    if (rawResults.exports) {
      if (Array.isArray(rawResults.exports)) {
        // Group by file
        const exportsByFile = new Map<string, string[]>();
        for (const exp of rawResults.exports) {
          const file = exp.file || exp.path;
          if (file) {
            if (!exportsByFile.has(file)) {
              exportsByFile.set(file, []);
            }
            exportsByFile.get(file)!.push(exp.symbol || exp.name || 'default');
          }
        }
        result.exports.unused = Array.from(exportsByFile.entries()).map(([file, symbols]) => ({
          file,
          symbols
        }));
      } else if (typeof rawResults.exports === 'object') {
        result.exports.unused = Object.entries(rawResults.exports).map(([file, symbols]) => ({
          file,
          symbols: Array.isArray(symbols) ? symbols : [symbols as string]
        }));
      }
    }
    
    if (rawResults.dependencies) {
      if (Array.isArray(rawResults.dependencies)) {
        result.dependencies.unused = rawResults.dependencies;
      } else if (rawResults.dependencies.unused) {
        result.dependencies.unused = rawResults.dependencies.unused;
      }
    }
    
    if (rawResults.devDependencies) {
      result.dependencies.unused.push(...(Array.isArray(rawResults.devDependencies) 
        ? rawResults.devDependencies 
        : []));
    }
    
    if (rawResults.unlisted) {
      result.dependencies.unlisted = Array.isArray(rawResults.unlisted) 
        ? rawResults.unlisted 
        : [];
    }
  }

  return result;
}

/**
 * Fallback parser for text output
 */
function parseKnipTextOutput(output: string): KnipAnalysisResult {
  const result: KnipAnalysisResult = {
    files: [],
    issues: [],
    dependencies: { unused: [], unlisted: [] },
    exports: { unused: [] },
  };

  const lines = output.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect sections
    if (trimmed.includes('Unused files')) {
      currentSection = 'files';
    } else if (trimmed.includes('Unused dependencies')) {
      currentSection = 'dependencies';
    } else if (trimmed.includes('Unused exports')) {
      currentSection = 'exports';
    } else if (trimmed.includes('Unlisted dependencies')) {
      currentSection = 'unlisted';
    } else if (trimmed && !trimmed.startsWith('─') && !trimmed.startsWith('═')) {
      // Parse content based on current section
      if (currentSection === 'files' && trimmed.includes('/')) {
        result.files.push(trimmed);
      } else if (currentSection === 'dependencies' && !trimmed.includes('/')) {
        result.dependencies.unused.push(trimmed);
      } else if (currentSection === 'unlisted' && !trimmed.includes('/')) {
        result.dependencies.unlisted.push(trimmed);
      } else if (currentSection === 'exports' && trimmed.includes('/')) {
        // Simple export parsing
        const parts = trimmed.split(/\s+/);
        if (parts.length > 0) {
          const file = parts[0];
          const symbol = parts[1] || 'default';
          
          const existing = result.exports.unused.find(e => e.file === file);
          if (existing) {
            existing.symbols.push(symbol);
          } else {
            result.exports.unused.push({
              file,
              symbols: [symbol]
            });
          }
        }
      }
    }
  }

  return result;
}

/**
 * Check if a Knip configuration exists in the given path
 */
async function checkForKnipConfig(basePath: string, packagePath?: string): Promise<boolean> {
  const targetPath = packagePath ? path.join(basePath, packagePath) : basePath;
  
  const configFiles = [
    'knip.json',
    '.knip.json',
    'knip.config.js',
    'knip.config.ts',
    'knip.config.mjs',
    'knip.config.cjs',
    'knip.jsonc'
  ];
  
  for (const configFile of configFiles) {
    const configPath = path.join(targetPath, configFile);
    if (await fileExists(configPath)) {
      console.log('[Knip] Found config file:', configPath);
      return true;
    }
  }
  
  // Also check if knip is configured in package.json
  const packageJsonPath = path.join(targetPath, 'package.json');
  if (await fileExists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      if (packageJson.knip) {
        console.log('[Knip] Found knip config in package.json');
        return true;
      }
    } catch (error) {
      console.error('[Knip] Error reading package.json:', error);
    }
  }
  
  return false;
}

/**
 * Try to run Knip locally when a config exists
 */
async function tryLocalKnipExecution(
  request: KnipAnalysisRequest,
  event: Electron.IpcMainInvokeEvent
): Promise<KnipAnalysisResult | null> {
  const targetPath = request.packagePath 
    ? path.join(request.path, request.packagePath) 
    : request.path;
    
  try {
    // Check if knip is available locally or globally
    const isKnipAvailable = await checkKnipAvailability();
    if (!isKnipAvailable) {
      console.log('[Knip] Knip not available locally or globally');
      return null;
    }
    
    // Send progress update
    event.sender.send('knip:analysis-progress', {
      message: `Running local Knip analysis for ${request.packageName || 'repository'}...`,
      percent: 30
    });
    
    console.log('[Knip] Running local Knip analysis in:', targetPath);
    
    // Try to run Knip with JSON reporter
    // Clear NODE_OPTIONS to avoid ts-node/register issues
    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_OPTIONS;
    
    await ensureCLIInitialized();
    const result = await electronCLI.execute('npx', ['knip', '--reporter', 'json'], {
      cwd: targetPath,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      env: { ...cleanEnv, NODE_ENV: 'production', NODE_OPTIONS: '' } as Record<string, string>,
      timeout: 120000 // 2 minute timeout
    });
    const { stdout, stderr } = result;
    
    if (stderr && !stdout) {
      console.error('[Knip] Local execution stderr:', stderr);
      return null;
    }
    
    // Parse the results
    const jsonOutput = extractJsonFromOutput(stdout);
    const analysisResult = parseKnipResults(JSON.parse(jsonOutput));
    
    // Add summary
    analysisResult.summary = {
      totalFiles: analysisResult.files.length,
      totalIssues: analysisResult.issues.length,
      unusedFiles: analysisResult.files.length,
      unusedExports: analysisResult.exports.unused.reduce((sum, e) => sum + e.symbols.length, 0),
      unusedDependencies: analysisResult.dependencies.unused.length,
    };
    
    console.log('[Knip] Local analysis complete. Summary:', analysisResult.summary);
    
    // Send completion
    event.sender.send('knip:analysis-progress', {
      message: 'Local analysis complete',
      percent: 100
    });
    
    return analysisResult;
  } catch (error: any) {
    console.error('[Knip] Local execution failed:', error);
    
    // Check if Knip found issues (exit code 1)
    if (error.code === 1 && error.stdout) {
      try {
        const jsonOutput = extractJsonFromOutput(error.stdout);
        const analysisResult = parseKnipResults(JSON.parse(jsonOutput));
        
        // Add summary
        analysisResult.summary = {
          totalFiles: analysisResult.files.length,
          totalIssues: analysisResult.issues.length,
          unusedFiles: analysisResult.files.length,
          unusedExports: analysisResult.exports.unused.reduce((sum, e) => sum + e.symbols.length, 0),
          unusedDependencies: analysisResult.dependencies.unused.length,
        };
        
        // Send completion
        event.sender.send('knip:analysis-progress', {
          message: 'Local analysis complete',
          percent: 100
        });
        
        return analysisResult;
      } catch (parseError) {
        console.error('[Knip] Failed to parse error output:', parseError);
      }
    }
    
    // If it's a ts-node error, provide helpful message
    if (error.stderr && error.stderr.includes('ts-node/register')) {
      console.error('[Knip] ts-node issue detected. This may be due to NODE_OPTIONS environment variable.');
    }
    
    return null;
  }
}

/**
 * Check if Knip is available locally or globally
 */
async function checkKnipAvailability(): Promise<boolean> {
  try {
    // First try npx which will use local or global
    // Clear NODE_OPTIONS to avoid ts-node/register issues
    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_OPTIONS;
    
    await ensureCLIInitialized();
    await electronCLI.execute('npx', ['--no-install', 'knip', '--version'], { 
      timeout: 5000,
      env: { ...cleanEnv, NODE_OPTIONS: '' } as Record<string, string>
    });
    return true;
  } catch {
    try {
      // Try global installation
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_OPTIONS;
      
      await ensureCLIInitialized();
      await electronCLI.execute('knip', ['--version'], { 
        timeout: 5000,
        env: { ...cleanEnv, NODE_OPTIONS: '' } as Record<string, string>
      });
      return true;
    } catch {
      return false;
    }
  }
}
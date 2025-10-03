import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { webContents } from 'electron';
import { EventEmitter } from 'events';
import { MemoryPalace, NodeFileSystemAdapter } from '@a24z/core-library';
import type { CreateTaskInput, ValidatedRepositoryPath } from '@a24z/core-library';
import { APP_BRANDING } from '../../shared/config/appBranding';
import { getManager as getRepositoryMonitoringManager } from '../repository-monitoring/ipcHandlers';

interface SlideDocument {
  filePath: string;
  content: string;
  slides: string[];
  currentSlide: number;
  slideIds: string[];
  metadata: {
    title?: string;
    lastModified?: Date;
    totalSlides?: number;
  };
}

interface SlideOperation {
  type: 'navigate' | 'load' | 'create' | 'update';
  params: any;
  timestamp: number;
}

interface SubmitDependencyTaskRequest {
  dependencyId: string;
  repositoryRoot?: string;
  taskSummary: string;
  taskDetails: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  tags?: string[];
  anchors?: string[];
}

interface DocumentOpenRequest {
  agentName: string;
  suggestedTitle?: string;
  suggestedType?: 'markdown' | 'excalidraw';
  message?: string;
}

export class PrincipalMCPBridge extends EventEmitter {
  private app: express.Application;
  private server: any;
  private port: number = APP_BRANDING.BRIDGE_PORTS.PRINCIPAL_MCP || 3043;
  private documents: Map<string, SlideDocument> = new Map();
  private operationHistory: SlideOperation[] = [];
  private currentDocument: SlideDocument | null = null;

  constructor(startPort?: number) {
    super();
    this.app = express();
    this.port = startPort || APP_BRANDING.BRIDGE_PORTS.PRINCIPAL_MCP || 3043;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS headers
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept',
      );

      if (_req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[Principal MCP Bridge] ${req.method} ${req.path}`);
      next();
    });
  }

  private generateSlideId(): string {
    return `slide-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private parseSlides(content: string): { slides: string[], slideIds: string[] } {
    // Split by horizontal rules (---) which serve as slide delimiters
    const slides = content
      .split(/\n---\n/)
      .filter((slide) => slide.trim().length > 0);
    
    const processedSlides = slides.length > 0 ? slides : ['# New Document\n\nStart writing...'];
    const slideIds = processedSlides.map(() => this.generateSlideId());
    
    return { slides: processedSlides, slideIds };
  }

  private joinSlides(slides: string[]): string {
    return slides.join('\n\n---\n\n');
  }

  private async loadDocument(filePath: string): Promise<SlideDocument> {
    try {
      // Check if document is already loaded
      if (this.documents.has(filePath)) {
        return this.documents.get(filePath)!;
      }

      // Try to load from file
      let content = '';
      let exists = false;

      try {
        content = await fs.readFile(filePath, 'utf-8');
        exists = true;
      } catch (err) {
        // File doesn't exist, create default content
        content = `# Planning Document\n\n## Overview\nStart your planning here...\n\n---\n\n# Tasks\n\n- [ ] Define objectives\n- [ ] Create timeline\n- [ ] Identify resources\n\n---\n\n# Notes\n\nAdd your notes here...`;
      }

      const { slides, slideIds } = this.parseSlides(content);
      const doc: SlideDocument = {
        filePath,
        content,
        slides,
        slideIds,
        currentSlide: 0,
        metadata: {
          title: path.basename(filePath, '.md'),
          lastModified: exists ? new Date() : undefined,
          totalSlides: slides.length,
        },
      };

      this.documents.set(filePath, doc);
      return doc;
    } catch (error) {
      console.error('[Principal MCP Bridge] Error loading document:', error);
      throw error;
    }
  }


  private recordOperation(operation: SlideOperation) {
    this.operationHistory.push(operation);
    // Keep only last 100 operations
    if (this.operationHistory.length > 100) {
      this.operationHistory = this.operationHistory.slice(-100);
    }
  }

  private notifyWindows(event: string, data: any) {
    console.log(`[Principal MCP Bridge] Notifying windows of ${event}:`, data);
    // Send update to all windows
    const allContents = webContents.getAllWebContents();
    console.log(
      `[Principal MCP Bridge] Found ${allContents.length} webContents`,
    );

    allContents.forEach((contents) => {
      // Only send to windows, not webviews or other types
      if (contents.getType() === 'window') {
        console.log(`[Principal MCP Bridge] Sending to window ${contents.id}`);
        contents.send('principal:' + event, data);
      }
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        message: 'Principal MCP Bridge is running',
        port: this.port,
        documentsLoaded: this.documents.size,
      });
    });

    // Submit Dependency Task
    this.app.post('/dependencies/submit', async (req: Request, res: Response) => {
      try {
        const request: SubmitDependencyTaskRequest = req.body;
        
        // Validate required fields
        if (!request.dependencyId || !request.taskSummary || !request.taskDetails) {
          res.status(400).json({ 
            success: false, 
            message: 'dependencyId, taskSummary, and taskDetails are required' 
          });
          return;
        }

        const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        // Resolve dependency using repository monitoring server
        let dependencyResolution = null;
        try {
          const repositoryMonitoring = getRepositoryMonitoringManager();
          dependencyResolution = await repositoryMonitoring.resolveDependency(
            request.dependencyId, 
            request.repositoryRoot
          );
          
          console.log('[Principal MCP Bridge] Dependency resolution result:', dependencyResolution);
        } catch (error) {
          console.error('[Principal MCP Bridge] Failed to resolve dependency:', error);
        }

        // Build response with resolution information
        const response: any = {
          success: true,
          taskId,
          repository: request.repositoryRoot,
          message: 'Dependency task submitted successfully',
          resolution: dependencyResolution || {
            dependencyId: request.dependencyId,
            found: false,
            message: 'Dependency resolution unavailable'
          }
        };

        // Add specific information based on resolution results
        if (dependencyResolution?.found) {
          if (dependencyResolution.alexandriaEntry) {
            response.message = `Found registered repository: ${dependencyResolution.alexandriaEntry.name}`;
            response.alexandriaEntry = dependencyResolution.alexandriaEntry;

            // Write task to dependency's Memory Palace
            try {
              const dependencyPath = dependencyResolution.alexandriaEntry.path;
              const fsAdapter = new NodeFileSystemAdapter();
              const validatedPath = MemoryPalace.validateRepositoryPath(
                fsAdapter,
                dependencyPath
              ) as ValidatedRepositoryPath;
              const palace = new MemoryPalace(validatedPath, fsAdapter);

              // Compose task content
              const content = request.taskDetails.trim().startsWith('#')
                ? request.taskDetails
                : `# ${request.taskSummary}\n\n${request.taskDetails}`;

              // Create task input
              const taskInput: CreateTaskInput = {
                content,
                directoryPath: '' as any, // Root of dependency repo
                priority: request.priority,
                tags: request.tags,
                anchors: request.anchors?.map(anchor => anchor as any) || [],
              };

              // Determine sender ID from source repository
              const senderName = request.repositoryRoot
                ? fsAdapter.getRepositoryName(request.repositoryRoot as ValidatedRepositoryPath)
                : 'external';

              // Write task to dependency's Memory Palace
              const task = palace.receiveTask(taskInput, senderName);

              response.taskWritten = true;
              response.taskPath = task.id;
              response.dependencyRepository = dependencyPath;

              console.log(`[Principal MCP Bridge] Task written to ${dependencyPath}/.palace-work/tasks/active/${task.id}.task.md`);
            } catch (error) {
              console.error('[Principal MCP Bridge] Failed to write task to dependency Memory Palace:', error);
              response.taskWritten = false;
              response.taskWriteError = error instanceof Error ? error.message : 'Unknown error';
            }
          } else if (dependencyResolution.packageInfo) {
            response.message = `Dependency already exists in ${dependencyResolution.packageInfo.packagePath}`;
            response.existingPackage = dependencyResolution.packageInfo;
          }

          if (dependencyResolution.suggestions) {
            response.installationSuggestions = dependencyResolution.suggestions;
          }
        } else {
          response.message = `Dependency '${request.dependencyId}' not found in registered repositories`;
        }

        res.json(response);

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          message: error.message 
        });
      }
    });

    // Resolve Dependency (without submitting task)
    this.app.post('/dependencies/resolve', async (req: Request, res: Response) => {
      try {
        const { dependencyId, repositoryRoot } = req.body;
        
        // Validate required fields
        if (!dependencyId) {
          res.status(400).json({ 
            success: false, 
            message: 'dependencyId is required' 
          });
          return;
        }

        // Resolve dependency using repository monitoring server
        try {
          const repositoryMonitoring = getRepositoryMonitoringManager();
          const dependencyResolution = await repositoryMonitoring.resolveDependency(
            dependencyId, 
            repositoryRoot
          );
          
          console.log('[Principal MCP Bridge] Dependency resolution result:', dependencyResolution);
          
          res.json({
            success: true,
            ...dependencyResolution
          });
        } catch (error) {
          console.error('[Principal MCP Bridge] Failed to resolve dependency:', error);
          res.status(500).json({
            success: false,
            message: 'Failed to resolve dependency',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          message: error.message 
        });
      }
    });

    // Start Planning Session - Document Open
    this.app.post('/document/open', async (req: Request, res: Response) => {
      try {
        const request: DocumentOpenRequest = req.body;
        
        if (!request.agentName) {
          res.status(400).json({ 
            success: false, 
            message: 'agentName is required' 
          });
          return;
        }

        // Generate a unique request ID
        const requestId = `agent-doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Emit event to renderer to show the document selection modal
        this.emit('agent-document-request', {
          requestId,
          agentName: request.agentName,
          suggestedTitle: request.suggestedTitle,
          suggestedType: request.suggestedType,
          message: request.message,
        });

        // Wait for response from renderer (with timeout)
        try {
          const response = await new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => {
              this.removeAllListeners(`agent-document-response-${requestId}`);
              reject(new Error('Document selection timeout'));
            }, 60000); // 60 second timeout

            this.once(`agent-document-response-${requestId}`, (data) => {
              clearTimeout(timeout);
              resolve(data);
            });
          });

          res.json(response);
        } catch (error: any) {
          res.status(500).json({
            success: false,
            documentSelected: false,
            message: error.message,
          });
        }
      } catch (error: any) {
        res.status(500).json({
          success: false,
          documentSelected: false,
          message: error.message,
        });
      }
    });

    // Create Slide
    this.app.post('/planning/create-slide', async (req: Request, res: Response) => {
      try {
        const { title, content, afterSlideId } = req.body;
        
        if (!title) {
          res.status(400).json({ 
            success: false, 
            message: 'title is required' 
          });
          return;
        }

        if (!this.currentDocument) {
          res.status(400).json({ 
            success: false, 
            message: 'No document is currently open' 
          });
          return;
        }

        const slideId = this.generateSlideId();
        const slideContent = content || `# ${title}\n\nContent here...`;
        
        let insertIndex = this.currentDocument.slides.length;
        
        // Find insertion point if afterSlideId is provided
        if (afterSlideId) {
          const afterIndex = this.currentDocument.slideIds.findIndex(id => id === afterSlideId);
          if (afterIndex !== -1) {
            insertIndex = afterIndex + 1;
          }
        }

        // Insert slide and slideId
        this.currentDocument.slides.splice(insertIndex, 0, slideContent);
        this.currentDocument.slideIds.splice(insertIndex, 0, slideId);
        this.currentDocument.content = this.joinSlides(this.currentDocument.slides);
        this.currentDocument.metadata.totalSlides = this.currentDocument.slides.length;

        this.recordOperation({
          type: 'create',
          params: { slideId, title, insertIndex },
          timestamp: Date.now(),
        });

        res.json({
          success: true,
          slideId,
        });

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          message: error.message 
        });
      }
    });

    // Update Slide
    this.app.post('/planning/update-slide', async (req: Request, res: Response) => {
      try {
        const { slideId, title, content } = req.body;
        
        if (!slideId) {
          res.status(400).json({ 
            success: false, 
            message: 'slideId is required' 
          });
          return;
        }

        if (!this.currentDocument) {
          res.status(400).json({ 
            success: false, 
            message: 'No document is currently open' 
          });
          return;
        }

        const slideIndex = this.currentDocument.slideIds.findIndex(id => id === slideId);
        if (slideIndex === -1) {
          res.status(404).json({ 
            success: false, 
            message: 'Slide not found' 
          });
          return;
        }

        // Update slide content
        if (content !== undefined) {
          this.currentDocument.slides[slideIndex] = content;
        } else if (title !== undefined) {
          // If only title is provided, update the first line (assuming it's a header)
          const lines = this.currentDocument.slides[slideIndex].split('\n');
          lines[0] = `# ${title}`;
          this.currentDocument.slides[slideIndex] = lines.join('\n');
        }

        this.currentDocument.content = this.joinSlides(this.currentDocument.slides);

        this.recordOperation({
          type: 'update',
          params: { slideId, slideIndex },
          timestamp: Date.now(),
        });

        res.json({
          success: true,
        });

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          message: error.message 
        });
      }
    });

    // Get Current Slide
    this.app.post('/planning/current-slide', async (req: Request, res: Response) => {
      try {
        const { includeContent = true } = req.body;

        if (!this.currentDocument) {
          res.status(400).json({ 
            success: false, 
            message: 'No document is currently open' 
          });
          return;
        }

        const currentSlideIndex = this.currentDocument.currentSlide;
        const slideId = this.currentDocument.slideIds[currentSlideIndex];
        const slideContent = this.currentDocument.slides[currentSlideIndex];
        
        // Extract title from first line (assuming it's a header)
        const lines = slideContent.split('\n');
        const title = lines[0].replace(/^#\s*/, '');

        const response: any = {
          success: true,
          slideId,
          title,
          position: currentSlideIndex,
        };

        if (includeContent) {
          response.content = slideContent;
        }

        res.json(response);

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          message: error.message 
        });
      }
    });

    // Navigate to Slide
    this.app.post('/planning/navigate-to-slide', async (req: Request, res: Response) => {
      try {
        const { slideId } = req.body;
        
        if (!slideId) {
          res.status(400).json({ 
            success: false, 
            message: 'slideId is required' 
          });
          return;
        }

        if (!this.currentDocument) {
          res.status(400).json({ 
            success: false, 
            message: 'No document is currently open' 
          });
          return;
        }

        const slideIndex = this.currentDocument.slideIds.findIndex(id => id === slideId);
        if (slideIndex === -1) {
          res.status(404).json({ 
            success: false, 
            message: 'Slide not found' 
          });
          return;
        }

        this.currentDocument.currentSlide = slideIndex;
        
        this.recordOperation({
          type: 'navigate',
          params: { slideId, slideIndex },
          timestamp: Date.now(),
        });

        // Notify renderer windows
        this.notifyWindows('slide-navigated', {
          filePath: this.currentDocument.filePath,
          currentSlide: this.currentDocument.currentSlide,
          slideId,
          content: this.currentDocument.slides[slideIndex],
          totalSlides: this.currentDocument.slides.length,
        });

        res.json({
          success: true,
          slideId,
        });

      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          message: error.message 
        });
      }
    });

    // Legacy endpoints for backward compatibility
    
    // Load or create document (legacy)
    this.app.post('/document/load', async (req: Request, res: Response) => {
      try {
        const { filePath } = req.body;
        if (!filePath) {
          res.status(400).json({ error: 'filePath is required' });
          return;
        }

        const doc = await this.loadDocument(filePath);
        this.currentDocument = doc;

        // Record the load operation
        this.recordOperation({
          type: 'load',
          params: { filePath },
          timestamp: Date.now(),
        });

        // Notify renderer windows that a document was loaded
        this.notifyWindows('document-loaded', {
          filePath: doc.filePath,
          slides: doc.slides,
          currentSlide: doc.currentSlide,
          metadata: doc.metadata,
        });

        res.json({
          success: true,
          document: {
            filePath: doc.filePath,
            slides: doc.slides,
            currentSlide: doc.currentSlide,
            metadata: doc.metadata,
          },
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get current slide (legacy)
    this.app.post('/slide/current', async (req: Request, res: Response) => {
      try {
        const { filePath } = req.body;
        console.log(
          `[Principal MCP Bridge] Getting current slide for: ${filePath}`,
        );

        if (!filePath) {
          console.error('[Principal MCP Bridge] No filePath provided');
          res.status(400).json({ error: 'filePath is required' });
          return;
        }

        const doc = await this.loadDocument(filePath);
        this.currentDocument = doc;
        console.log(
          `[Principal MCP Bridge] Document loaded: ${doc.slides.length} slides, current: ${doc.currentSlide}`,
        );

        res.json({
          slideNumber: doc.currentSlide,
          content: doc.slides[doc.currentSlide],
          totalSlides: doc.slides.length,
        });
      } catch (error: any) {
        console.error('[Principal MCP Bridge] Error in /slide/current:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Navigate to slide (legacy)
    this.app.post('/slide/navigate', async (req: Request, res: Response) => {
      try {
        const { filePath, slideNumber } = req.body;
        const doc = await this.loadDocument(filePath);
        this.currentDocument = doc;

        if (slideNumber < 0 || slideNumber >= doc.slides.length) {
          res.status(400).json({ error: 'Invalid slide number' });
          return;
        }

        doc.currentSlide = slideNumber;
        this.recordOperation({
          type: 'navigate',
          params: { slideNumber },
          timestamp: Date.now(),
        });

        // Notify renderer windows
        this.notifyWindows('slide-navigated', {
          filePath,
          currentSlide: doc.currentSlide,
          content: doc.slides[doc.currentSlide],
          totalSlides: doc.slides.length,
        });

        res.json({
          success: true,
          currentSlide: doc.currentSlide,
          content: doc.slides[doc.currentSlide],
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all slides (legacy)
    this.app.post('/slide/list', async (req: Request, res: Response) => {
      try {
        const { filePath } = req.body;
        const doc = await this.loadDocument(filePath);
        this.currentDocument = doc;

        res.json({
          slides: doc.slides,
          currentSlide: doc.currentSlide,
          metadata: doc.metadata,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get operation history
    this.app.get('/history', (_req: Request, res: Response) => {
      res.json({
        operations: this.operationHistory,
        count: this.operationHistory.length,
      });
    });
  }

  public async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      const tryListen = (attemptPort: number, attempts: number = 0) => {
        if (attempts >= 10) {
          reject(
            new Error('Failed to find available port for Principal MCP Bridge'),
          );
          return;
        }

        this.server = this.app.listen(attemptPort, 'localhost', () => {
          this.port = attemptPort;
          console.log(`✅ Principal MCP Bridge started on port ${this.port}`);
          resolve(this.port);
        });

        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.log(
              `Port ${attemptPort} in use, trying ${attemptPort + 1}...`,
            );
            tryListen(attemptPort + 1, attempts + 1);
          } else {
            reject(err);
          }
        });
      };

      tryListen(this.port);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close(() => {
        console.log('Principal MCP Bridge stopped');
      });
      this.server = null;
    }
  }

  public getPort(): number {
    return this.port;
  }

  public getDocuments(): Map<string, SlideDocument> {
    return this.documents;
  }

  public getCurrentDocument(): SlideDocument | null {
    return this.currentDocument;
  }

  public setCurrentDocument(doc: SlideDocument | null): void {
    this.currentDocument = doc;
  }
}

// Singleton instance
let principalMCPBridge: PrincipalMCPBridge | null = null;

export function getPrincipalMCPBridge(): PrincipalMCPBridge {
  if (!principalMCPBridge) {
    principalMCPBridge = new PrincipalMCPBridge();
  }
  return principalMCPBridge;
}

export function startPrincipalMCPBridge(): Promise<number> {
  const bridge = getPrincipalMCPBridge();
  return bridge.start();
}

export function stopPrincipalMCPBridge(): void {
  if (principalMCPBridge) {
    principalMCPBridge.stop();
    principalMCPBridge = null;
  }
}
import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BrowserWindow, webContents } from 'electron';
import { EventEmitter } from 'events';
import { APP_BRANDING } from '../../shared/config/appBranding';

interface SlideDocument {
  filePath: string;
  content: string;
  slides: string[];
  currentSlide: number;
  metadata: {
    title?: string;
    lastModified?: Date;
    totalSlides?: number;
  };
}

interface SlideOperation {
  type: 'navigate' | 'load';
  params: any;
  timestamp: number;
}

export class PlanningMCPBridge extends EventEmitter {
  private app: express.Application;
  private server: any;
  private port: number = APP_BRANDING.BRIDGE_PORTS.PLANNING_MCP; // Use correct port from APP_BRANDING
  private documents: Map<string, SlideDocument> = new Map();
  private operationHistory: SlideOperation[] = [];

  constructor(startPort?: number) {
    super();
    this.app = express();
    this.port = startPort || APP_BRANDING.BRIDGE_PORTS.PLANNING_MCP;
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
      console.log(`[Planning MCP Bridge] ${req.method} ${req.path}`);
      next();
    });
  }

  private parseSlides(content: string): string[] {
    // Split by horizontal rules (---) which serve as slide delimiters
    const slides = content
      .split(/\n---\n/)
      .filter((slide) => slide.trim().length > 0);
    return slides.length > 0 ? slides : ['# New Document\n\nStart writing...'];
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

      const slides = this.parseSlides(content);
      const doc: SlideDocument = {
        filePath,
        content,
        slides,
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
      console.error('[Planning MCP Bridge] Error loading document:', error);
      throw error;
    }
  }

  // Removed saveDocument method - Planning bridge is now read-only

  private recordOperation(operation: SlideOperation) {
    this.operationHistory.push(operation);
    // Keep only last 100 operations
    if (this.operationHistory.length > 100) {
      this.operationHistory = this.operationHistory.slice(-100);
    }
  }

  private notifyWindows(event: string, data: any) {
    console.log(`[Planning MCP Bridge] Notifying windows of ${event}:`, data);
    // Send update to all windows
    const allContents = webContents.getAllWebContents();
    console.log(
      `[Planning MCP Bridge] Found ${allContents.length} webContents`,
    );

    allContents.forEach((contents) => {
      // Only send to windows, not webviews or other types
      if (contents.getType() === 'window') {
        console.log(`[Planning MCP Bridge] Sending to window ${contents.id}`);
        contents.send('planning:' + event, data);
      }
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        message: 'Planning MCP Bridge is running',
        port: this.port,
        documentsLoaded: this.documents.size,
      });
    });

    // Load or create document
    this.app.post('/document/load', async (req: Request, res: Response) => {
      try {
        const { filePath } = req.body;
        if (!filePath) {
          res.status(400).json({ error: 'filePath is required' });
          return;
        }

        const doc = await this.loadDocument(filePath);

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

    // Get current slide
    this.app.post('/slide/current', async (req: Request, res: Response) => {
      try {
        const { filePath } = req.body;
        console.log(
          `[Planning MCP Bridge] Getting current slide for: ${filePath}`,
        );

        if (!filePath) {
          console.error('[Planning MCP Bridge] No filePath provided');
          res.status(400).json({ error: 'filePath is required' });
          return;
        }

        const doc = await this.loadDocument(filePath);
        console.log(
          `[Planning MCP Bridge] Document loaded: ${doc.slides.length} slides, current: ${doc.currentSlide}`,
        );

        res.json({
          slideNumber: doc.currentSlide,
          content: doc.slides[doc.currentSlide],
          totalSlides: doc.slides.length,
        });
      } catch (error: any) {
        console.error('[Planning MCP Bridge] Error in /slide/current:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Navigate to slide
    this.app.post('/slide/navigate', async (req: Request, res: Response) => {
      try {
        const { filePath, slideNumber } = req.body;
        const doc = await this.loadDocument(filePath);

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

    // Get all slides
    this.app.post('/slide/list', async (req: Request, res: Response) => {
      try {
        const { filePath } = req.body;
        const doc = await this.loadDocument(filePath);

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
            new Error('Failed to find available port for Planning MCP Bridge'),
          );
          return;
        }

        this.server = this.app.listen(attemptPort, 'localhost', () => {
          this.port = attemptPort;
          console.log(`✅ Planning MCP Bridge started on port ${this.port}`);
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
        console.log('Planning MCP Bridge stopped');
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
}

// Singleton instance
let planningMCPBridge: PlanningMCPBridge | null = null;

export function getPlanningMCPBridge(): PlanningMCPBridge {
  if (!planningMCPBridge) {
    planningMCPBridge = new PlanningMCPBridge();
  }
  return planningMCPBridge;
}

export function startPlanningMCPBridge(): Promise<number> {
  const bridge = getPlanningMCPBridge();
  return bridge.start();
}

export function stopPlanningMCPBridge(): void {
  if (planningMCPBridge) {
    planningMCPBridge.stop();
    planningMCPBridge = null;
  }
}

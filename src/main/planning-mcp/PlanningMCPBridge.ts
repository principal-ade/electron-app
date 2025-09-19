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
  type:
    | 'navigate'
    | 'update'
    | 'create'
    | 'delete'
    | 'move'
    | 'merge'
    | 'split';
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

  private async saveDocument(filePath: string): Promise<boolean> {
    try {
      const doc = this.documents.get(filePath);
      if (!doc) return false;

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Save to file
      await fs.writeFile(filePath, doc.content, 'utf-8');

      // Update metadata
      doc.metadata.lastModified = new Date();

      // Emit save event
      this.emit('document-saved', { filePath, slides: doc.slides.length });

      return true;
    } catch (error) {
      console.error('[Planning MCP Bridge] Error saving document:', error);
      return false;
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

    // Update slide content
    this.app.post('/slide/update', async (req: Request, res: Response) => {
      try {
        const { filePath, slideNumber, content, autoSave = false } = req.body;
        const doc = await this.loadDocument(filePath);

        if (slideNumber < 0 || slideNumber >= doc.slides.length) {
          res.status(400).json({ error: 'Invalid slide number' });
          return;
        }

        doc.slides[slideNumber] = content;
        doc.content = this.joinSlides(doc.slides);

        if (autoSave) {
          await this.saveDocument(filePath);
        }

        this.recordOperation({
          type: 'update',
          params: { slideNumber, contentLength: content.length },
          timestamp: Date.now(),
        });

        // Notify renderer windows
        this.emit('slide-updated', { filePath, slideNumber, content });

        // Make sure doc exists before accessing its properties
        if (doc && doc.slides) {
          this.notifyWindows('slide-updated', {
            filePath,
            slideNumber,
            content,
            slides: doc.slides,
            currentSlide: doc.currentSlide,
          });
        }

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Create new slide
    this.app.post('/slide/create', async (req: Request, res: Response) => {
      try {
        const {
          filePath,
          position = 'after',
          content = '# New Slide\n\nContent here...',
          autoSave = false,
        } = req.body;
        const doc = await this.loadDocument(filePath);

        let insertIndex: number;
        if (position === 'end') {
          insertIndex = doc.slides.length;
        } else if (position === 'before') {
          insertIndex = doc.currentSlide;
        } else {
          insertIndex = doc.currentSlide + 1;
        }

        doc.slides.splice(insertIndex, 0, content);
        doc.content = this.joinSlides(doc.slides);
        doc.metadata.totalSlides = doc.slides.length;

        // Update current slide if needed
        if (position === 'before') {
          doc.currentSlide = insertIndex;
        } else if (position === 'after') {
          doc.currentSlide = insertIndex;
        }

        if (autoSave) {
          await this.saveDocument(filePath);
        }

        this.recordOperation({
          type: 'create',
          params: { position, insertIndex },
          timestamp: Date.now(),
        });

        res.json({
          success: true,
          slideNumber: insertIndex,
          totalSlides: doc.slides.length,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete slide
    this.app.post('/slide/delete', async (req: Request, res: Response) => {
      try {
        const { filePath, slideNumber, autoSave = false } = req.body;
        const doc = await this.loadDocument(filePath);

        if (doc.slides.length <= 1) {
          res.status(400).json({ error: 'Cannot delete the last slide' });
          return;
        }

        if (slideNumber < 0 || slideNumber >= doc.slides.length) {
          res.status(400).json({ error: 'Invalid slide number' });
          return;
        }

        doc.slides.splice(slideNumber, 1);
        doc.content = this.joinSlides(doc.slides);
        doc.metadata.totalSlides = doc.slides.length;

        // Adjust current slide if needed
        if (doc.currentSlide >= doc.slides.length) {
          doc.currentSlide = doc.slides.length - 1;
        }

        if (autoSave) {
          await this.saveDocument(filePath);
        }

        this.recordOperation({
          type: 'delete',
          params: { slideNumber },
          timestamp: Date.now(),
        });

        res.json({
          success: true,
          totalSlides: doc.slides.length,
          currentSlide: doc.currentSlide,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Move slide
    this.app.post('/slide/move', async (req: Request, res: Response) => {
      try {
        const { filePath, from, to, autoSave = false } = req.body;
        const doc = await this.loadDocument(filePath);

        if (
          from < 0 ||
          from >= doc.slides.length ||
          to < 0 ||
          to >= doc.slides.length
        ) {
          res.status(400).json({ error: 'Invalid slide positions' });
          return;
        }

        const [movedSlide] = doc.slides.splice(from, 1);
        doc.slides.splice(to, 0, movedSlide);
        doc.content = this.joinSlides(doc.slides);

        if (autoSave) {
          await this.saveDocument(filePath);
        }

        this.recordOperation({
          type: 'move',
          params: { from, to },
          timestamp: Date.now(),
        });

        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Search slides
    this.app.post('/slide/search', async (req: Request, res: Response) => {
      try {
        const { filePath, query, caseSensitive = false } = req.body;
        const doc = await this.loadDocument(filePath);

        const searchQuery = caseSensitive ? query : query.toLowerCase();
        const results = [];

        for (let i = 0; i < doc.slides.length; i++) {
          const slideContent = caseSensitive
            ? doc.slides[i]
            : doc.slides[i].toLowerCase();
          if (slideContent.includes(searchQuery)) {
            const lines = doc.slides[i].split('\n');
            const matches = lines
              .map((line, lineNum) => {
                const lineToSearch = caseSensitive ? line : line.toLowerCase();
                if (lineToSearch.includes(searchQuery)) {
                  return { lineNumber: lineNum, line: lines[lineNum] };
                }
                return null;
              })
              .filter(Boolean);

            results.push({
              slideNumber: i,
              matches,
            });
          }
        }

        res.json({ results });
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

    // Save document
    this.app.post('/document/save', async (req: Request, res: Response) => {
      try {
        const { filePath } = req.body;
        const success = await this.saveDocument(filePath);

        res.json({ success });
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

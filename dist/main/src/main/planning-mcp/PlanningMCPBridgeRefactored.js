import express from 'express';
import { EventEmitter } from 'events';
import { SlideDocumentManager } from './core/SlideDocumentManager';
import { ElectronFileSystemAdapter } from './adapters/ElectronFileSystemAdapter';
/**
 * Refactored Planning MCP Bridge that uses the core SlideDocumentManager
 * This thin layer just handles HTTP requests and delegates to the core manager
 */
export class PlanningMCPBridgeRefactored extends EventEmitter {
    app;
    server;
    port = 3045;
    documentManager;
    constructor(startPort) {
        super();
        this.app = express();
        this.port = startPort || 3045;
        // Use Electron adapter for this implementation
        const fileSystemAdapter = new ElectronFileSystemAdapter();
        this.documentManager = new SlideDocumentManager(fileSystemAdapter);
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        // CORS headers
        this.app.use((_req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            if (_req.method === 'OPTIONS') {
                res.sendStatus(200);
            }
            else {
                next();
            }
        });
        // Request logging
        this.app.use((req, _res, next) => {
            console.log(`[Planning MCP Bridge] ${req.method} ${req.path}`);
            next();
        });
    }
    setupRoutes() {
        // Health check
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                timestamp: Date.now(),
                message: 'Planning MCP Bridge is running',
                port: this.port
            });
        });
        // Open document selection dialog
        this.app.post('/document/open', async (req, res) => {
            try {
                const { agentName, suggestedTitle, suggestedType, message } = req.body;
                // Generate a unique request ID
                const requestId = `agent-doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                // Emit event to renderer to show the document selection modal
                this.emit('agent-document-request', {
                    requestId,
                    agentName,
                    suggestedTitle,
                    suggestedType,
                    message
                });
                // Wait for response from renderer (with timeout)
                const response = await new Promise((resolve, reject) => {
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
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    documentSelected: false
                });
            }
        });
        // Load or create document
        this.app.post('/document/load', async (req, res) => {
            try {
                const { filePath } = req.body;
                if (!filePath) {
                    res.status(400).json({ error: 'filePath is required' });
                    return;
                }
                const doc = await this.documentManager.loadDocument(filePath);
                res.json({
                    success: true,
                    document: {
                        filePath: doc.filePath,
                        slides: doc.slides,
                        currentSlide: doc.currentSlide,
                        metadata: doc.metadata
                    }
                });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Get current slide
        this.app.post('/slide/current', async (req, res) => {
            try {
                const { filePath } = req.body;
                const doc = await this.documentManager.loadDocument(filePath);
                res.json({
                    slideNumber: doc.currentSlide,
                    content: doc.slides[doc.currentSlide],
                    totalSlides: doc.slides.length
                });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Navigate to slide
        this.app.post('/slide/navigate', async (req, res) => {
            try {
                const { filePath, slideNumber } = req.body;
                await this.documentManager.loadDocument(filePath);
                const success = this.documentManager.navigateToSlide(filePath, slideNumber);
                if (!success) {
                    res.status(400).json({ error: 'Invalid slide number' });
                    return;
                }
                const doc = this.documentManager.getDocument(filePath);
                res.json({
                    success: true,
                    currentSlide: doc.currentSlide,
                    content: doc.slides[doc.currentSlide]
                });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Update slide content
        this.app.post('/slide/update', async (req, res) => {
            try {
                const { filePath, slideNumber, content, autoSave = false } = req.body;
                await this.documentManager.loadDocument(filePath);
                const success = this.documentManager.updateSlide(filePath, slideNumber, content);
                if (!success) {
                    res.status(400).json({ error: 'Invalid slide number' });
                    return;
                }
                if (autoSave) {
                    await this.documentManager.saveDocument(filePath);
                }
                // Notify renderer
                this.emit('slide-updated', { filePath, slideNumber, content });
                res.json({ success: true });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Create new slide
        this.app.post('/slide/create', async (req, res) => {
            try {
                const { filePath, position = 'after', content, autoSave = false } = req.body;
                await this.documentManager.loadDocument(filePath);
                const slideNumber = this.documentManager.createSlide(filePath, position, content);
                if (slideNumber === -1) {
                    res.status(400).json({ error: 'Failed to create slide' });
                    return;
                }
                if (autoSave) {
                    await this.documentManager.saveDocument(filePath);
                }
                const doc = this.documentManager.getDocument(filePath);
                res.json({
                    success: true,
                    slideNumber,
                    totalSlides: doc.slides.length
                });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Delete slide
        this.app.post('/slide/delete', async (req, res) => {
            try {
                const { filePath, slideNumber, autoSave = false } = req.body;
                await this.documentManager.loadDocument(filePath);
                const success = this.documentManager.deleteSlide(filePath, slideNumber);
                if (!success) {
                    res.status(400).json({ error: 'Cannot delete slide' });
                    return;
                }
                if (autoSave) {
                    await this.documentManager.saveDocument(filePath);
                }
                const doc = this.documentManager.getDocument(filePath);
                res.json({
                    success: true,
                    totalSlides: doc.slides.length,
                    currentSlide: doc.currentSlide
                });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Move slide
        this.app.post('/slide/move', async (req, res) => {
            try {
                const { filePath, from, to, autoSave = false } = req.body;
                await this.documentManager.loadDocument(filePath);
                const success = this.documentManager.moveSlide(filePath, from, to);
                if (!success) {
                    res.status(400).json({ error: 'Invalid slide positions' });
                    return;
                }
                if (autoSave) {
                    await this.documentManager.saveDocument(filePath);
                }
                res.json({ success: true });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Search slides
        this.app.post('/slide/search', async (req, res) => {
            try {
                const { filePath, query, caseSensitive = false } = req.body;
                await this.documentManager.loadDocument(filePath);
                const results = this.documentManager.searchSlides(filePath, query, caseSensitive);
                res.json({ results });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Get all slides
        this.app.post('/slide/list', async (req, res) => {
            try {
                const { filePath } = req.body;
                const doc = await this.documentManager.loadDocument(filePath);
                res.json({
                    slides: doc.slides,
                    currentSlide: doc.currentSlide,
                    metadata: doc.metadata
                });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Save document
        this.app.post('/document/save', async (req, res) => {
            try {
                const { filePath } = req.body;
                const success = await this.documentManager.saveDocument(filePath);
                res.json({ success });
            }
            catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // Get operation history
        this.app.get('/history', (_req, res) => {
            const history = this.documentManager.getHistory();
            res.json({
                operations: history,
                count: history.length
            });
        });
    }
    async start() {
        return new Promise((resolve, reject) => {
            const tryListen = (attemptPort, attempts = 0) => {
                if (attempts >= 10) {
                    reject(new Error('Failed to find available port for Planning MCP Bridge'));
                    return;
                }
                this.server = this.app.listen(attemptPort, '127.0.0.1', () => {
                    this.port = attemptPort;
                    console.log(`✅ Planning MCP Bridge started on port ${this.port}`);
                    resolve(this.port);
                });
                this.server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        console.log(`Port ${attemptPort} in use, trying ${attemptPort + 1}...`);
                        tryListen(attemptPort + 1, attempts + 1);
                    }
                    else {
                        reject(err);
                    }
                });
            };
            tryListen(this.port);
        });
    }
    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log('Planning MCP Bridge stopped');
            });
            this.server = null;
        }
    }
    getPort() {
        return this.port;
    }
    getDocumentManager() {
        return this.documentManager;
    }
}

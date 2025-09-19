/**
 * Example VS Code Extension Implementation
 * Shows how the same core SlideDocumentManager can be used in VS Code
 */
import * as vscode from 'vscode';
import { SlideDocumentManager } from '../core/SlideDocumentManager';
import { VSCodeFileSystemAdapter } from '../adapters/VSCodeFileSystemAdapter';
export class PlanningViewProvider {
  _extensionUri;
  _context;
  _view;
  documentManager;
  currentFilePath;
  constructor(_extensionUri, _context) {
    this._extensionUri = _extensionUri;
    this._context = _context;
    // Initialize with VS Code adapter
    const adapter = new VSCodeFileSystemAdapter(vscode);
    this.documentManager = new SlideDocumentManager(adapter);
  }
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'loadDocument':
          await this.loadDocument(data.filePath);
          break;
        case 'navigateSlide':
          await this.navigateSlide(data.slideNumber);
          break;
        case 'updateSlide':
          await this.updateSlide(data.slideNumber, data.content);
          break;
        case 'createSlide':
          await this.createSlide(data.position, data.content);
          break;
        case 'deleteSlide':
          await this.deleteSlide(data.slideNumber);
          break;
        case 'saveDocument':
          await this.saveDocument();
          break;
      }
    });
  }
  async loadDocument(filePath) {
    this.currentFilePath = filePath;
    const doc = await this.documentManager.loadDocument(filePath);
    this._view?.webview.postMessage({
      type: 'documentLoaded',
      document: {
        slides: doc.slides,
        currentSlide: doc.currentSlide,
        metadata: doc.metadata,
      },
    });
  }
  async navigateSlide(slideNumber) {
    if (!this.currentFilePath) return;
    const success = this.documentManager.navigateToSlide(
      this.currentFilePath,
      slideNumber,
    );
    if (success) {
      const doc = this.documentManager.getDocument(this.currentFilePath);
      this._view?.webview.postMessage({
        type: 'slideNavigated',
        currentSlide: doc.currentSlide,
        content: doc.slides[doc.currentSlide],
      });
    }
  }
  async updateSlide(slideNumber, content) {
    if (!this.currentFilePath) return;
    const success = this.documentManager.updateSlide(
      this.currentFilePath,
      slideNumber,
      content,
    );
    if (success) {
      this._view?.webview.postMessage({
        type: 'slideUpdated',
        slideNumber,
        content,
      });
    }
  }
  async createSlide(position, content) {
    if (!this.currentFilePath) return;
    const slideNumber = this.documentManager.createSlide(
      this.currentFilePath,
      position,
      content,
    );
    if (slideNumber !== -1) {
      const doc = this.documentManager.getDocument(this.currentFilePath);
      this._view?.webview.postMessage({
        type: 'slideCreated',
        slideNumber,
        totalSlides: doc.slides.length,
      });
    }
  }
  async deleteSlide(slideNumber) {
    if (!this.currentFilePath) return;
    const success = this.documentManager.deleteSlide(
      this.currentFilePath,
      slideNumber,
    );
    if (success) {
      const doc = this.documentManager.getDocument(this.currentFilePath);
      this._view?.webview.postMessage({
        type: 'slideDeleted',
        totalSlides: doc.slides.length,
        currentSlide: doc.currentSlide,
      });
    }
  }
  async saveDocument() {
    if (!this.currentFilePath) return;
    const success = await this.documentManager.saveDocument(
      this.currentFilePath,
    );
    this._view?.webview.postMessage({
      type: 'documentSaved',
      success,
    });
  }
  /**
   * Register MCP tools that agents can use
   */
  registerMCPTools() {
    // In VS Code, these would be registered as commands that agents can invoke
    const commands = [
      vscode.commands.registerCommand('planning.getCurrentSlide', async () => {
        if (!this.currentFilePath) return null;
        const doc = this.documentManager.getDocument(this.currentFilePath);
        if (!doc) return null;
        return {
          slideNumber: doc.currentSlide,
          content: doc.slides[doc.currentSlide],
          totalSlides: doc.slides.length,
        };
      }),
      vscode.commands.registerCommand(
        'planning.navigateToSlide',
        async (slideNumber) => {
          if (!this.currentFilePath) return false;
          return this.documentManager.navigateToSlide(
            this.currentFilePath,
            slideNumber,
          );
        },
      ),
      vscode.commands.registerCommand(
        'planning.updateSlide',
        async (slideNumber, content) => {
          if (!this.currentFilePath) return false;
          return this.documentManager.updateSlide(
            this.currentFilePath,
            slideNumber,
            content,
          );
        },
      ),
      vscode.commands.registerCommand(
        'planning.createSlide',
        async (position, content) => {
          if (!this.currentFilePath) return -1;
          return this.documentManager.createSlide(
            this.currentFilePath,
            position,
            content,
          );
        },
      ),
      vscode.commands.registerCommand(
        'planning.deleteSlide',
        async (slideNumber) => {
          if (!this.currentFilePath) return false;
          return this.documentManager.deleteSlide(
            this.currentFilePath,
            slideNumber,
          );
        },
      ),
      vscode.commands.registerCommand(
        'planning.searchSlides',
        async (query, caseSensitive) => {
          if (!this.currentFilePath) return [];
          return this.documentManager.searchSlides(
            this.currentFilePath,
            query,
            caseSensitive || false,
          );
        },
      ),
    ];
    // Store command disposables
    this._context.subscriptions.push(...commands);
  }
  _getHtmlForWebview(webview) {
    // This would contain the UI for the planning view
    // Similar to the IndustryMarkdownSlide component but adapted for VS Code
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Planning View</title>
      <style>
        /* VS Code styling */
        body { 
          padding: 0; 
          margin: 0;
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
        }
        .slide-container {
          padding: 20px;
        }
        .slide-navigation {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .slide-content {
          padding: 20px;
          min-height: 400px;
        }
        button {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 6px 14px;
          cursor: pointer;
        }
        button:hover {
          background: var(--vscode-button-hoverBackground);
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>
    </head>
    <body>
      <div class="slide-container">
        <div class="slide-navigation">
          <button id="prevSlide">Previous</button>
          <span id="slideInfo">Slide 1 of 1</span>
          <button id="nextSlide">Next</button>
        </div>
        <div class="slide-content" id="slideContent">
          <p>Loading...</p>
        </div>
      </div>
      
      <script>
        const vscode = acquireVsCodeApi();
        let currentSlide = 0;
        let totalSlides = 0;
        let slides = [];
        
        // Handle messages from extension
        window.addEventListener('message', event => {
          const message = event.data;
          switch (message.type) {
            case 'documentLoaded':
              slides = message.document.slides;
              currentSlide = message.document.currentSlide;
              totalSlides = message.document.slides.length;
              updateUI();
              break;
            case 'slideNavigated':
              currentSlide = message.currentSlide;
              updateUI();
              break;
          }
        });
        
        // Navigation handlers
        document.getElementById('prevSlide').addEventListener('click', () => {
          if (currentSlide > 0) {
            vscode.postMessage({ type: 'navigateSlide', slideNumber: currentSlide - 1 });
          }
        });
        
        document.getElementById('nextSlide').addEventListener('click', () => {
          if (currentSlide < totalSlides - 1) {
            vscode.postMessage({ type: 'navigateSlide', slideNumber: currentSlide + 1 });
          }
        });
        
        function updateUI() {
          document.getElementById('slideInfo').textContent = \`Slide \${currentSlide + 1} of \${totalSlides}\`;
          document.getElementById('slideContent').innerHTML = renderMarkdown(slides[currentSlide] || '');
          document.getElementById('prevSlide').disabled = currentSlide === 0;
          document.getElementById('nextSlide').disabled = currentSlide === totalSlides - 1;
        }
        
        function renderMarkdown(content) {
          // Basic markdown rendering - in real implementation would use a proper markdown renderer
          return content
            .replace(/^# (.*)/gm, '<h1>$1</h1>')
            .replace(/^## (.*)/gm, '<h2>$1</h2>')
            .replace(/^### (.*)/gm, '<h3>$1</h3>')
            .replace(/\\n/g, '<br>');
        }
      </script>
    </body>
    </html>`;
  }
}

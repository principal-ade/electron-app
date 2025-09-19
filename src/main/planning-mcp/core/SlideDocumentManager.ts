/**
 * SlideDocumentManager - Core business logic for slide operations
 * Platform-agnostic implementation that can be used in Electron, VS Code, or web
 */

export interface SlideDocument {
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

export interface SlideOperation {
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

export interface IFileSystemAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}

export class SlideDocumentManager {
  private documents: Map<string, SlideDocument> = new Map();
  private operationHistory: SlideOperation[] = [];
  private slideDelimiter: string = '\n---\n';

  constructor(private fileSystem: IFileSystemAdapter) {}

  /**
   * Parse markdown content into slides
   */
  public parseSlides(content: string): string[] {
    const slides = content
      .split(this.slideDelimiter)
      .filter((slide) => slide.trim().length > 0);
    return slides.length > 0 ? slides : ['# New Document\n\nStart writing...'];
  }

  /**
   * Join slides back into markdown content
   */
  public joinSlides(slides: string[]): string {
    return slides.join('\n\n---\n\n');
  }

  /**
   * Load or create a document
   */
  public async loadDocument(filePath: string): Promise<SlideDocument> {
    // Check cache first
    if (this.documents.has(filePath)) {
      return this.documents.get(filePath)!;
    }

    let content = '';
    let exists = false;

    try {
      exists = await this.fileSystem.exists(filePath);
      if (exists) {
        content = await this.fileSystem.readFile(filePath);
      } else {
        content = this.getDefaultContent();
      }
    } catch (err) {
      content = this.getDefaultContent();
    }

    const slides = this.parseSlides(content);
    const doc: SlideDocument = {
      filePath,
      content,
      slides,
      currentSlide: 0,
      metadata: {
        title: this.extractTitle(filePath),
        lastModified: exists ? new Date() : undefined,
        totalSlides: slides.length,
      },
    };

    this.documents.set(filePath, doc);
    return doc;
  }

  /**
   * Save document to file system
   */
  public async saveDocument(filePath: string): Promise<boolean> {
    try {
      const doc = this.documents.get(filePath);
      if (!doc) return false;

      // Ensure directory exists
      const dir = this.getDirectory(filePath);
      await this.fileSystem.mkdir(dir, { recursive: true });

      // Save to file
      await this.fileSystem.writeFile(filePath, doc.content);

      // Update metadata
      doc.metadata.lastModified = new Date();

      return true;
    } catch (error) {
      console.error('Error saving document:', error);
      return false;
    }
  }

  /**
   * Navigate to a specific slide
   */
  public navigateToSlide(filePath: string, slideNumber: number): boolean {
    const doc = this.documents.get(filePath);
    if (!doc || slideNumber < 0 || slideNumber >= doc.slides.length) {
      return false;
    }

    doc.currentSlide = slideNumber;
    this.recordOperation({
      type: 'navigate',
      params: { slideNumber },
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Update slide content
   */
  public updateSlide(
    filePath: string,
    slideNumber: number,
    content: string,
  ): boolean {
    const doc = this.documents.get(filePath);
    if (!doc || slideNumber < 0 || slideNumber >= doc.slides.length) {
      return false;
    }

    doc.slides[slideNumber] = content;
    doc.content = this.joinSlides(doc.slides);

    this.recordOperation({
      type: 'update',
      params: { slideNumber, contentLength: content.length },
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Create a new slide
   */
  public createSlide(
    filePath: string,
    position: 'before' | 'after' | 'end',
    content: string = '# New Slide\n\nContent here...',
  ): number {
    const doc = this.documents.get(filePath);
    if (!doc) return -1;

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
    if (position === 'before' || position === 'after') {
      doc.currentSlide = insertIndex;
    }

    this.recordOperation({
      type: 'create',
      params: { position, insertIndex },
      timestamp: Date.now(),
    });

    return insertIndex;
  }

  /**
   * Delete a slide
   */
  public deleteSlide(filePath: string, slideNumber: number): boolean {
    const doc = this.documents.get(filePath);
    if (
      !doc ||
      doc.slides.length <= 1 ||
      slideNumber < 0 ||
      slideNumber >= doc.slides.length
    ) {
      return false;
    }

    doc.slides.splice(slideNumber, 1);
    doc.content = this.joinSlides(doc.slides);
    doc.metadata.totalSlides = doc.slides.length;

    // Adjust current slide if needed
    if (doc.currentSlide >= doc.slides.length) {
      doc.currentSlide = doc.slides.length - 1;
    }

    this.recordOperation({
      type: 'delete',
      params: { slideNumber },
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Move a slide to a new position
   */
  public moveSlide(filePath: string, from: number, to: number): boolean {
    const doc = this.documents.get(filePath);
    if (
      !doc ||
      from < 0 ||
      from >= doc.slides.length ||
      to < 0 ||
      to >= doc.slides.length
    ) {
      return false;
    }

    const [movedSlide] = doc.slides.splice(from, 1);
    doc.slides.splice(to, 0, movedSlide);
    doc.content = this.joinSlides(doc.slides);

    this.recordOperation({
      type: 'move',
      params: { from, to },
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Search for text in slides
   */
  public searchSlides(
    filePath: string,
    query: string,
    caseSensitive: boolean = false,
  ): Array<{
    slideNumber: number;
    matches: Array<{ lineNumber: number; line: string }>;
  }> {
    const doc = this.documents.get(filePath);
    if (!doc) return [];

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
          .filter(Boolean) as Array<{ lineNumber: number; line: string }>;

        results.push({
          slideNumber: i,
          matches,
        });
      }
    }

    return results;
  }

  /**
   * Get current document state
   */
  public getDocument(filePath: string): SlideDocument | undefined {
    return this.documents.get(filePath);
  }

  /**
   * Get all slides
   */
  public getAllSlides(filePath: string): string[] {
    const doc = this.documents.get(filePath);
    return doc ? doc.slides : [];
  }

  /**
   * Get operation history
   */
  public getHistory(): SlideOperation[] {
    return this.operationHistory;
  }

  /**
   * Clear a document from cache
   */
  public clearDocument(filePath: string): void {
    this.documents.delete(filePath);
  }

  /**
   * Clear all documents
   */
  public clearAll(): void {
    this.documents.clear();
    this.operationHistory = [];
  }

  // Helper methods
  private recordOperation(operation: SlideOperation) {
    this.operationHistory.push(operation);
    // Keep only last 100 operations
    if (this.operationHistory.length > 100) {
      this.operationHistory = this.operationHistory.slice(-100);
    }
  }

  private getDefaultContent(): string {
    return `# Planning Document

## Overview
Start your planning here...

---

# Tasks

- [ ] Define objectives
- [ ] Create timeline
- [ ] Identify resources

---

# Notes

Add your notes here...`;
  }

  private extractTitle(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    return filename.replace(/\.(md|markdown)$/i, '');
  }

  private getDirectory(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    parts.pop();
    return parts.join('/');
  }
}

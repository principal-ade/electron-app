# Terminal Image Drag-and-Drop Design Document

**Status**: Draft
**Author**: Development Team
**Created**: 2025-11-16
**Last Updated**: 2025-11-16

---

## Executive Summary

This document outlines the design for implementing drag-and-drop image support in the terminal panel. Users will be able to drag screenshots or images directly into the terminal, which will be automatically uploaded and sent to Claude for analysis, enabling a more natural development workflow.

---

## 1. Goals and Non-Goals

### Goals

- Enable users to drag and drop images (screenshots, diagrams, UI mockups) into the terminal
- Support common image formats (PNG, JPEG, GIF, WebP)
- Provide clear visual feedback during drag operations
- Integrate seamlessly with existing Claude API conversation flow
- Handle multiple images in a single drop operation
- Maintain terminal session continuity during image uploads
- Support both AI-connected terminals and standalone terminals

### Non-Goals

- Video file support (future consideration)
- Real-time OCR or image processing in the terminal
- Image editing or manipulation features
- Support for non-image file types (PDFs, documents)
- Drag-and-drop for uploading to file system (use file explorer instead)

---

## 2. User Stories

### Primary User Stories

1. **As a developer**, I want to drag a screenshot into the terminal so that I can ask Claude about UI bugs or design issues
2. **As a developer**, I want to paste error screenshots directly into my development session without switching contexts
3. **As a developer**, I want to share multiple screenshots at once to explain a complex problem
4. **As a developer**, I want clear feedback when my image is too large or unsupported

### User Flow

```
1. User takes screenshot (Cmd+Shift+4 on macOS)
2. User drags screenshot file over terminal
3. Terminal shows visual feedback (border highlight + "Drop image here")
4. User releases mouse (drops image)
5. Terminal shows upload indicator
6. Image is processed and sent to Claude
7. Terminal displays confirmation message
8. User can continue conversation with image context
```

---

## 3. Architecture

### 3.1 Component Overview

```
┌─────────────────────────────────────────────────────┐
│         TerminalPanelPackaged.tsx                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  Drag & Drop Handler Layer                    │  │
│  │  - onDragOver, onDragLeave, onDrop           │  │
│  │  - Visual feedback overlay                    │  │
│  └────────────────┬──────────────────────────────┘  │
│                   │                                  │
│                   ▼                                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Image Processing Service                     │  │
│  │  - File validation                            │  │
│  │  - Base64 conversion                          │  │
│  │  - Size checking                              │  │
│  └────────────────┬──────────────────────────────┘  │
│                   │                                  │
│                   ▼                                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Image Attachment Service                     │  │
│  │  - Temporary storage                          │  │
│  │  - Metadata tracking                          │  │
│  │  - Cleanup management                         │  │
│  └────────────────┬──────────────────────────────┘  │
│                   │                                  │
└───────────────────┼──────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│         AgentSessionService                         │
│  - Send image attachments to Claude API             │
│  - Format multi-modal content blocks                │
│  - Handle conversation context                      │
└─────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```typescript
// 1. User drops image
DragEvent → handleDrop()
           ↓
// 2. Extract and validate files
FileList → filterImageFiles() → ImageFile[]
           ↓
// 3. Convert to base64
ImageFile → FileReader.readAsDataURL() → base64String
           ↓
// 4. Process attachment
base64String → ImageAttachmentService.process()
              ↓
              {
                id: string,
                name: string,
                type: string,
                data: string,
                size: number,
                timestamp: number
              }
              ↓
// 5. Send to Claude
ImageAttachment → AgentSessionService.sendWithAttachments()
                 ↓
                 Claude API (multi-modal content)
```

---

## 4. Technical Specification

### 4.1 New Services

#### ImageAttachmentService (`src/renderer/services/ImageAttachmentService.ts`)

```typescript
interface ImageAttachment {
  id: string;                    // Unique identifier
  name: string;                  // Original filename
  type: string;                  // MIME type
  data: string;                  // Base64 encoded image data
  size: number;                  // File size in bytes
  timestamp: number;             // Upload timestamp
  sessionId?: string;            // Associated terminal/agent session
}

interface ImageValidationResult {
  valid: boolean;
  error?: string;
  attachment?: ImageAttachment;
}

class ImageAttachmentService {
  // Configuration
  static readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB (Claude limit)
  static readonly SUPPORTED_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp'
  ];

  // Validate image file
  static async validate(file: File): Promise<ImageValidationResult>;

  // Process and convert image
  static async process(file: File): Promise<ImageAttachment>;

  // Batch process multiple images
  static async processBatch(files: File[]): Promise<ImageAttachment[]>;

  // Save to temporary storage
  static async saveTemporary(attachment: ImageAttachment): Promise<string>;

  // Clean up temporary files
  static async cleanup(attachmentId: string): Promise<void>;

  // Get attachment by ID
  static async getAttachment(id: string): Promise<ImageAttachment | null>;
}
```

### 4.2 Component Modifications

#### TerminalPanelPackaged.tsx Updates

```typescript
interface TerminalPanelPackagedProps {
  // ... existing props

  /** Enable drag-and-drop image support */
  enableImageDrop?: boolean;

  /** Callback when images are attached */
  onImagesAttached?: (attachments: ImageAttachment[]) => void;

  /** Maximum number of images per drop */
  maxImagesPerDrop?: number;
}

// New state
const [isDragging, setIsDragging] = useState(false);
const [uploadProgress, setUploadProgress] = useState<{
  current: number;
  total: number;
} | null>(null);
const containerRef = useRef<HTMLDivElement>(null);

// New handlers
const handleDragOver = useCallback((e: React.DragEvent) => { /*...*/ }, []);
const handleDragLeave = useCallback((e: React.DragEvent) => { /*...*/ }, []);
const handleDrop = useCallback(async (e: React.DragEvent) => { /*...*/ }, []);
const handleImageUpload = useCallback(async (files: File[]) => { /*...*/ }, []);
```

#### AgentSessionService.ts Updates

```typescript
interface SendMessageWithAttachmentsParams {
  sessionId: string;
  text: string;
  attachments: ImageAttachment[];
  repositoryPath: string;
}

class AgentSessionService {
  // ... existing methods

  /**
   * Send message to Claude with image attachments
   * Formats content as multi-modal (text + images)
   */
  static async sendWithAttachments(
    params: SendMessageWithAttachmentsParams
  ): Promise<void>;

  /**
   * Format images for Claude API
   * Converts ImageAttachment[] to Claude content blocks
   */
  private static formatImageContent(
    text: string,
    attachments: ImageAttachment[]
  ): ClaudeMessageContent[];
}
```

### 4.3 File Structure

```
src/
├── renderer/
│   ├── services/
│   │   ├── ImageAttachmentService.ts        [NEW]
│   │   └── ImageValidationService.ts        [NEW]
│   ├── main-process-api/
│   │   ├── AgentSessionService.ts           [MODIFIED]
│   │   └── FileStorageService.ts            [NEW]
│   ├── panels/
│   │   └── TerminalPanelPackaged.tsx        [MODIFIED]
│   ├── components/
│   │   └── ImageUploadIndicator.tsx         [NEW]
│   └── hooks/
│       └── useImageDragDrop.ts              [NEW]
├── main/
│   ├── services/
│   │   └── tempFileManager.ts               [NEW]
│   └── ipc/
│       └── imageAttachmentHandlers.ts       [NEW]
└── shared/
    └── types/
        └── imageAttachment.types.ts         [NEW]
```

---

## 5. User Interface Design

### 5.1 Visual States

#### 5.1.1 Default State
- Terminal displays normally
- No visual changes

#### 5.1.2 Drag Over State
```
┌─────────────────────────────────────────────┐
│  Terminal                                   │
│  ╔═══════════════════════════════════════╗  │
│  ║                                       ║  │ <- Dashed border
│  ║         Drop image here               ║  │    (#00D9FF)
│  ║                                       ║  │
│  ║  📸  Supports PNG, JPEG, GIF, WebP   ║  │
│  ║                                       ║  │
│  ╚═══════════════════════════════════════╝  │
└─────────────────────────────────────────────┘
```

#### 5.1.3 Upload Progress State
```
┌─────────────────────────────────────────────┐
│  Terminal                                   │
│                                             │
│  $ npm run dev                              │
│  ┌───────────────────────────────────────┐  │
│  │ 📤 Uploading images... (2/3)          │  │
│  │ [██████████░░░░░░░░░░] 66%           │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

#### 5.1.4 Success State
```
┌─────────────────────────────────────────────┐
│  Terminal                                   │
│                                             │
│  $ npm run dev                              │
│  ✅ Attached 3 images                       │
│  • screenshot-1.png (245 KB)                │
│  • error-dialog.png (128 KB)                │
│  • ui-mockup.png (512 KB)                   │
│  >                                          │
└─────────────────────────────────────────────┘
```

#### 5.1.5 Error State
```
┌─────────────────────────────────────────────┐
│  Terminal                                   │
│                                             │
│  $ npm run dev                              │
│  ❌ Failed to attach images:                │
│  • large-file.png - File too large (8.2 MB) │
│  • document.pdf - Unsupported format        │
│  >                                          │
└─────────────────────────────────────────────┘
```

### 5.2 Visual Specifications

```css
/* Drag overlay */
.drag-overlay {
  background: rgba(0, 217, 255, 0.1);
  border: 2px dashed #00D9FF;
  backdrop-filter: blur(4px);
}

/* Drop zone indicator */
.drop-indicator {
  font-size: 18px;
  font-weight: 600;
  color: #00D9FF;
  text-align: center;
}

/* Upload progress bar */
.upload-progress {
  height: 4px;
  background: rgba(0, 217, 255, 0.2);
  border-radius: 2px;
}

.upload-progress-fill {
  background: #00D9FF;
  transition: width 0.2s ease;
}
```

---

## 6. Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

**Tasks:**
1. Create `ImageAttachmentService` with validation logic
2. Create `ImageValidationService` for file checking
3. Create `imageAttachment.types.ts` with TypeScript interfaces
4. Add temporary file storage in main process
5. Write unit tests for validation logic

**Deliverables:**
- Services can validate and process image files
- Base64 conversion working
- File size and type validation working

### Phase 2: UI Integration (Week 1-2)

**Tasks:**
1. Add drag-and-drop handlers to `TerminalPanelPackaged.tsx`
2. Create `useImageDragDrop` custom hook
3. Implement visual feedback overlay
4. Create `ImageUploadIndicator` component
5. Add terminal output formatting for attachments

**Deliverables:**
- Users can drag images into terminal
- Visual feedback displays correctly
- Terminal shows upload status

### Phase 3: Claude Integration (Week 2)

**Tasks:**
1. Extend `AgentSessionService.sendWithAttachments()`
2. Format multi-modal content blocks for Claude API
3. Handle image attachments in conversation context
4. Add session-attachment association tracking
5. Implement error handling and retry logic

**Deliverables:**
- Images successfully sent to Claude API
- Multi-modal conversations working
- Error handling complete

### Phase 4: Polish & Testing (Week 3)

**Tasks:**
1. Add comprehensive error messages
2. Implement batch upload optimization
3. Add cleanup for temporary files
4. Write integration tests
5. Add user preference for enabling/disabling feature
6. Performance testing with large images
7. Write user documentation

**Deliverables:**
- Feature fully tested
- Performance optimized
- Documentation complete

---

## 7. Error Handling

### 7.1 Client-Side Validation Errors

| Error | User Message | Action |
|-------|-------------|---------|
| File too large | `❌ Image too large: {filename} ({size}). Max size: 5MB` | Reject file, show error |
| Unsupported format | `❌ Unsupported format: {filename}. Use PNG, JPEG, GIF, or WebP` | Reject file, show error |
| Too many files | `❌ Too many images. Max {max} images per drop` | Accept first N, show warning |
| Corrupted file | `❌ Could not read image: {filename}` | Reject file, show error |

### 7.2 Server-Side Errors

| Error | User Message | Action |
|-------|-------------|---------|
| Upload failed | `❌ Upload failed. Please try again` | Retry with exponential backoff |
| Claude API error | `❌ Failed to send to Claude: {error}` | Show error, keep local copy |
| Storage full | `❌ Storage full. Clean up temporary files` | Show cleanup prompt |
| Network error | `❌ Network error. Check connection` | Queue for retry |

### 7.3 Fallback Behavior

```typescript
// If drag-and-drop fails, provide alternative methods
const fallbackOptions = [
  'Use file picker (click to browse)',
  'Paste from clipboard (Cmd+V)',
  'Use command: /attach-image <path>'
];
```

---

## 8. Performance Considerations

### 8.1 Optimization Strategies

1. **Lazy Loading**: Don't load image processing library until first drag event
2. **Debouncing**: Debounce drag events to avoid excessive re-renders
3. **Progressive Upload**: Upload images one at a time, show progress
4. **Memory Management**: Release FileReader objects after processing
5. **Cleanup**: Auto-delete temporary files after 24 hours

### 8.2 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Time to visual feedback | < 50ms | From drag start to border change |
| Base64 conversion | < 200ms | For 2MB image |
| Upload to Claude | < 3s | Depends on network |
| Memory footprint | < 50MB | For 5 concurrent images |
| Cleanup frequency | Every 24h | Background task |

### 8.3 Image Optimization

```typescript
// Optional: Compress images before upload
interface CompressionOptions {
  maxWidth: 2000;
  maxHeight: 2000;
  quality: 0.85;
}

// For very large screenshots, auto-resize
async function optimizeImage(file: File): Promise<Blob> {
  if (file.size < 1 * 1024 * 1024) return file; // < 1MB, no optimization

  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  // ... resize logic
  return canvas.toBlob({ quality: 0.85 });
}
```

---

## 9. Security Considerations

### 9.1 Input Validation

```typescript
// Strict MIME type checking
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp'
];

// Magic number validation (check actual file headers)
const FILE_SIGNATURES = {
  png: [0x89, 0x50, 0x4E, 0x47],
  jpeg: [0xFF, 0xD8, 0xFF],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46]
};

async function validateFileSignature(file: File): Promise<boolean> {
  const header = await file.slice(0, 8).arrayBuffer();
  // ... check against signatures
}
```

### 9.2 Data Sanitization

- Remove EXIF metadata (may contain location data)
- Validate base64 encoding
- Prevent XSS via filename display (escape HTML)
- Limit concurrent uploads (prevent DoS)

### 9.3 Storage Security

- Use isolated temporary directory per session
- Automatic cleanup on session end
- No persistent storage of sensitive images
- Encrypt temp files if containing sensitive data

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
describe('ImageAttachmentService', () => {
  test('validates image size correctly', async () => {
    const largeFile = createMockFile(6 * 1024 * 1024); // 6MB
    const result = await ImageAttachmentService.validate(largeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  test('accepts valid PNG file', async () => {
    const validFile = createMockPNG(1 * 1024 * 1024); // 1MB
    const result = await ImageAttachmentService.validate(validFile);
    expect(result.valid).toBe(true);
  });

  test('converts to base64 correctly', async () => {
    const file = createMockPNG(100 * 1024);
    const attachment = await ImageAttachmentService.process(file);
    expect(attachment.data).toMatch(/^data:image\/png;base64,/);
  });
});
```

### 10.2 Integration Tests

```typescript
describe('Terminal Drag and Drop', () => {
  test('shows overlay on drag over', () => {
    const { container } = render(<TerminalPanelPackaged {...props} />);
    const dragEvent = createDragEvent('dragover', [mockImageFile]);
    fireEvent(container, dragEvent);
    expect(screen.getByText(/drop image here/i)).toBeInTheDocument();
  });

  test('processes dropped image', async () => {
    const onImagesAttached = jest.fn();
    const { container } = render(
      <TerminalPanelPackaged {...props} onImagesAttached={onImagesAttached} />
    );

    const dropEvent = createDragEvent('drop', [mockImageFile]);
    fireEvent(container, dropEvent);

    await waitFor(() => {
      expect(onImagesAttached).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'test.png' })
      ]);
    });
  });
});
```

### 10.3 End-to-End Tests

```typescript
describe('Image Drag Drop E2E', () => {
  test('complete workflow: drag, drop, upload, display in Claude', async () => {
    // 1. Open terminal
    await openTerminal();

    // 2. Drag screenshot
    await dragFile('screenshot.png', terminalSelector);

    // 3. Verify visual feedback
    await expect(page.locator('.drag-overlay')).toBeVisible();

    // 4. Drop file
    await dropFile();

    // 5. Wait for upload
    await expect(page.locator('.upload-progress')).toBeVisible();
    await expect(page.locator('.upload-progress')).toBeHidden({ timeout: 10000 });

    // 6. Verify attachment in terminal
    await expect(page.locator('text=Attached 1 image')).toBeVisible();

    // 7. Verify sent to Claude
    const messages = await getClaudeMessages();
    expect(messages[0].content).toContainEqual(
      expect.objectContaining({ type: 'image' })
    );
  });
});
```

### 10.4 Manual Testing Checklist

- [ ] Drag single PNG image
- [ ] Drag multiple images (2-5)
- [ ] Drag unsupported file (PDF, video)
- [ ] Drag oversized image (> 5MB)
- [ ] Drag from different sources (Finder, browser, screenshot app)
- [ ] Test on macOS, Windows, Linux
- [ ] Test with slow network
- [ ] Test with Claude API down
- [ ] Test with full disk
- [ ] Test terminal ownership changes during upload
- [ ] Test rapid consecutive drops

---

## 11. User Preferences & Configuration

### 11.1 Settings

Add to `UserPreferencesService`:

```typescript
interface UserPreferences {
  // ... existing preferences

  // Image drag-and-drop settings
  terminal: {
    enableImageDrop: boolean;           // Default: true
    maxImagesPerDrop: number;          // Default: 5
    autoCompressImages: boolean;       // Default: true
    showUploadProgress: boolean;       // Default: true
    imageUploadNotifications: boolean; // Default: true
  }
}
```

### 11.2 Settings UI

```
┌─────────────────────────────────────────────┐
│  Terminal Settings                          │
│                                             │
│  Image Drag & Drop                          │
│  ☑ Enable drag-and-drop images             │
│  ☑ Auto-compress large images               │
│  ☑ Show upload progress                     │
│  ☑ Show upload notifications                │
│                                             │
│  Max images per drop: [5 ▼]                │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 12. Accessibility

### 12.1 Keyboard Alternatives

Since drag-and-drop is mouse-only, provide keyboard alternatives:

```typescript
// Keyboard shortcut: Cmd+Shift+I (attach image)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'i') {
      e.preventDefault();
      openImagePicker();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### 12.2 Screen Reader Support

```tsx
<div
  role="region"
  aria-label="Terminal with image upload support"
  aria-describedby="drop-instructions"
>
  <div id="drop-instructions" className="sr-only">
    Drag and drop images here, or press Cmd+Shift+I to select files
  </div>

  {isDragging && (
    <div role="alert" aria-live="polite">
      Drop zone active. Release to upload image.
    </div>
  )}
</div>
```

---

## 13. Monitoring & Analytics

### 13.1 Metrics to Track

```typescript
interface ImageDropMetrics {
  // Usage metrics
  totalDrops: number;
  successfulUploads: number;
  failedUploads: number;
  averageImageSize: number;
  averageUploadTime: number;

  // Error metrics
  errorsByType: Record<string, number>;
  validationFailures: Record<string, number>;

  // Performance metrics
  p50UploadTime: number;
  p95UploadTime: number;
  p99UploadTime: number;
}

// Track events
trackEvent('terminal.image.dropped', {
  imageCount: files.length,
  totalSize: files.reduce((sum, f) => sum + f.size, 0),
  formats: files.map(f => f.type),
});

trackEvent('terminal.image.upload.success', {
  uploadTime: Date.now() - startTime,
  imageSize: file.size,
  format: file.type,
});

trackEvent('terminal.image.upload.failed', {
  error: error.message,
  imageSize: file.size,
  format: file.type,
});
```

---

## 14. Future Enhancements

### 14.1 Phase 2 Features (Post-Launch)

1. **Clipboard Paste Support**
   - Cmd+V to paste images from clipboard
   - Auto-detect clipboard contains image data

2. **Image Annotation**
   - Draw arrows/boxes on images before sending
   - Add text labels to highlight issues

3. **Image History**
   - View recently attached images
   - Re-attach previous images

4. **Smart Compression**
   - Auto-compress based on network speed
   - Offer quality slider for large images

5. **OCR Integration**
   - Extract text from screenshots
   - Send both image and extracted text to Claude

### 14.2 Advanced Features

1. **Video Screenshot Capture**
   - Record 5-second clips of terminal
   - Convert to GIF for sharing

2. **Image Gallery View**
   - Side panel showing all images in conversation
   - Click to enlarge

3. **Direct Screenshot Capture**
   - Built-in screenshot tool (Cmd+Shift+S)
   - Auto-attach to terminal

4. **Cloud Storage Integration**
   - Save images to cloud (S3, CloudFlare R2)
   - Share persistent URLs

---

## 15. Documentation Requirements

### 15.1 User Documentation

Create the following docs:

1. **User Guide**: "Attaching Images to Terminal Sessions"
   - How to drag and drop
   - Supported formats
   - Size limits
   - Keyboard shortcuts

2. **FAQ**: Common questions
   - Why did my image fail to upload?
   - How to compress large images
   - What happens to my images?

3. **Video Tutorial**: 2-minute screencast
   - Demonstrate drag-and-drop workflow
   - Show error handling

### 15.2 Developer Documentation

1. **API Reference**: `ImageAttachmentService` methods
2. **Integration Guide**: Using image attachments in other components
3. **Testing Guide**: How to test drag-and-drop features
4. **Architecture Overview**: This design doc

---

## 16. Success Metrics

### 16.1 Adoption Metrics

| Metric | Target | Measurement Period |
|--------|--------|-------------------|
| % of users who try feature | > 30% | First month |
| Images dropped per active user | > 5 | First month |
| Feature retention | > 60% | After 7 days |

### 16.2 Quality Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Upload success rate | > 95% | Excluding user errors |
| Average upload time | < 3s | For 2MB image |
| Error rate | < 5% | Server-side errors |
| User satisfaction | > 4.0/5 | From feedback survey |

### 16.3 Performance Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Time to first visual feedback | < 50ms | Drag over → border change |
| Memory overhead | < 50MB | Per terminal session |
| CPU usage during upload | < 10% | On modern CPU |

---

## 17. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Large images slow down UI | High | Medium | Auto-compress, show progress |
| Claude API size limits change | Medium | Low | Version checking, graceful degradation |
| Memory leaks from base64 | High | Medium | Aggressive cleanup, memory profiling |
| Users upload sensitive data | High | Medium | Add privacy warning, no persistent storage |
| Browser compatibility issues | Medium | Low | Feature detection, polyfills |
| Terminal ownership conflicts | Medium | Medium | Disable during ownership transfer |

---

## 18. Dependencies

### 18.1 External Dependencies

- **xterm.js**: Terminal emulator (already in use)
- **@principal-ade/industry-themed-terminal**: Terminal wrapper (already in use)
- **Browser File API**: FileReader, File, Blob
- **Browser Drag-and-Drop API**: DragEvent, DataTransfer

### 18.2 Internal Dependencies

- `AgentSessionService`: Claude API integration
- `TerminalService`: Terminal session management
- `UserPreferencesService`: User settings
- `ShellService`: File system operations (for temp storage)

### 18.3 New Dependencies (Optional)

Consider adding:
- **image-compression** (28KB): Client-side image optimization
- **file-type** (12KB): Better MIME type detection
- **exifreader** (45KB): EXIF metadata removal

---

## 19. Rollout Plan

### 19.1 Phased Rollout

1. **Alpha** (Week 1-2): Internal team testing
   - Enable for engineering team only
   - Gather feedback, fix critical bugs

2. **Beta** (Week 3-4): Limited user testing
   - Enable for 10% of users
   - Monitor metrics, error rates
   - Iterate on UX based on feedback

3. **General Availability** (Week 5): Full rollout
   - Enable for all users
   - Feature announcement
   - Documentation published

### 19.2 Feature Flag

```typescript
// Feature flag control
const FEATURE_FLAGS = {
  TERMINAL_IMAGE_DROP: {
    enabled: process.env.ENABLE_IMAGE_DROP === 'true',
    rolloutPercentage: 10, // Start at 10%
  }
};

// Usage
if (isFeatureEnabled('TERMINAL_IMAGE_DROP', userId)) {
  enableImageDrop = true;
}
```

---

## 20. Appendices

### Appendix A: Claude API Multi-Modal Format

```typescript
// Example Claude API request with image
{
  model: "claude-sonnet-4-5",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: "iVBORw0KGgoAAAANSUhEUgAA..." // base64 without prefix
          }
        },
        {
          type: "text",
          text: "What's wrong with this error message?"
        }
      ]
    }
  ]
}
```

### Appendix B: File Size Reference

```
Image Type       | Typical Size | Max Recommended
-----------------|--------------|----------------
Screenshot (PNG) | 200KB - 2MB  | 3MB
Photo (JPEG)     | 500KB - 5MB  | 5MB
Diagram (PNG)    | 50KB - 500KB | 1MB
GIF (animated)   | 1MB - 10MB   | 3MB (or compress)
WebP            | 100KB - 1MB  | 2MB
```

### Appendix C: Browser Compatibility

| Browser | Version | Drag-and-Drop | FileReader | Notes |
|---------|---------|---------------|------------|-------|
| Chrome  | 90+     | ✅            | ✅         | Full support |
| Firefox | 88+     | ✅            | ✅         | Full support |
| Safari  | 14+     | ✅            | ✅         | Full support |
| Edge    | 90+     | ✅            | ✅         | Full support |

All supported browsers have native drag-and-drop and FileReader APIs.

---

## 21. Open Questions

1. **Should we support clipboard paste in addition to drag-and-drop?**
   - Decision: Yes, add in Phase 2

2. **What happens if user drags image while terminal is owned by another window?**
   - Decision: Show error, prompt to take ownership first

3. **Should we add image preview before sending to Claude?**
   - Decision: No for MVP, consider for Phase 2

4. **Do we need to support SVG files?**
   - Decision: No, SVG can contain scripts (security risk)

5. **Should we track image attachments in conversation history?**
   - Decision: Yes, store metadata but not actual image data

---

## 22. Approval & Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Lead | TBD | TBD | Pending |
| Engineering Lead | TBD | TBD | Pending |
| Design Lead | TBD | TBD | Pending |
| Security Review | TBD | TBD | Pending |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-11-16 | Development Team | Initial draft |

---

**End of Document**

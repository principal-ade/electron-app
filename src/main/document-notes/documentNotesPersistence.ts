/**
 * Disk persistence for user-authored notes attached to markdown documents.
 *
 * Layout under `app.getPath('userData')`:
 *
 *   document-notes/
 *     repo-agnostic/<fileHash>.json    notes for files outside any repo
 *     <projectHash>/<fileHash>.json    notes keyed by md5(repositoryPath)
 *
 * Each JSON file holds *all* notes for one document. fileHash = md5 of the
 * relativeFilePath, so the same file always maps to the same on-disk record.
 * Renames orphan their notes; that's an accepted v1 tradeoff.
 *
 * No manifest — the library endpoint walks the disk on demand. Notes per file
 * are tiny and reads are O(1) by hash, so this is fine until proven otherwise.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type {
  DocumentNote,
  DocumentNoteDraft,
  DocumentNotesFileSummary,
} from '../../shared/types/document-notes.types';

interface DocumentNotesFileV1 {
  version: 1;
  repositoryPath?: string;
  relativeFilePath: string;
  notes: DocumentNote[];
  createdAt: string;
  updatedAt: string;
}

const REPO_AGNOSTIC_DIR = 'repo-agnostic';

const projectHash = (repositoryPath: string): string => {
  const normalized = path.resolve(repositoryPath);
  return crypto.createHash('md5').update(normalized).digest('hex');
};

const fileHashOf = (relativeFilePath: string): string =>
  crypto.createHash('md5').update(relativeFilePath).digest('hex');

const subdirFor = (repositoryPath?: string): string =>
  repositoryPath ? projectHash(repositoryPath) : REPO_AGNOSTIC_DIR;

export class DocumentNotesPersistence {
  private readonly baseDir: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.baseDir = path.join(app.getPath('userData'), 'document-notes');
  }

  private filePathOf(
    repositoryPath: string | undefined,
    relativeFilePath: string,
  ): string {
    return path.join(
      this.baseDir,
      subdirFor(repositoryPath),
      `${fileHashOf(relativeFilePath)}.json`,
    );
  }

  async listForFile(
    repositoryPath: string | undefined,
    relativeFilePath: string,
  ): Promise<DocumentNote[]> {
    const file = this.filePathOf(repositoryPath, relativeFilePath);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as DocumentNotesFileV1;
      return Array.isArray(parsed.notes) ? parsed.notes : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      console.error('[DocumentNotesPersistence] read failed', file, err);
      return [];
    }
  }

  async createNote(
    repositoryPath: string | undefined,
    relativeFilePath: string,
    draft: DocumentNoteDraft,
  ): Promise<DocumentNote> {
    return this.applyToFile(repositoryPath, relativeFilePath, (existing) => {
      const now = new Date().toISOString();
      const note: DocumentNote = {
        id: `note-${crypto.randomUUID()}`,
        anchor: draft.anchor,
        metadata: {
          body: draft.body,
          author: draft.author,
          createdAt: now,
          updatedAt: now,
        },
      };
      return { notes: [...existing, note], result: note };
    });
  }

  async updateNote(
    repositoryPath: string | undefined,
    relativeFilePath: string,
    noteId: string,
    body: string,
  ): Promise<DocumentNote | null> {
    return this.applyToFile(repositoryPath, relativeFilePath, (existing) => {
      const idx = existing.findIndex((n) => n.id === noteId);
      if (idx < 0) return { notes: existing, result: null };
      const prev = existing[idx];
      const next: DocumentNote = {
        ...prev,
        metadata: {
          ...prev.metadata,
          body,
          updatedAt: new Date().toISOString(),
        },
      };
      const notes = [...existing];
      notes[idx] = next;
      return { notes, result: next };
    });
  }

  async deleteNote(
    repositoryPath: string | undefined,
    relativeFilePath: string,
    noteId: string,
  ): Promise<boolean> {
    return this.applyToFile(repositoryPath, relativeFilePath, (existing) => {
      const next = existing.filter((n) => n.id !== noteId);
      return { notes: next, result: next.length !== existing.length };
    });
  }

  /**
   * Walk all stored notes files. Optional filter by repositoryPath.
   */
  async listAllFiles(repositoryPath?: string): Promise<DocumentNotesFileSummary[]> {
    const out: DocumentNotesFileSummary[] = [];
    let subdirs: string[];
    try {
      subdirs = await fs.readdir(this.baseDir);
    } catch {
      return out;
    }
    const targetSubdir = repositoryPath ? subdirFor(repositoryPath) : null;
    for (const subdir of subdirs) {
      if (targetSubdir && subdir !== targetSubdir) continue;
      const subdirPath = path.join(this.baseDir, subdir);
      let stat;
      try {
        stat = await fs.stat(subdirPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      let files: string[];
      try {
        files = await fs.readdir(subdirPath);
      } catch {
        continue;
      }
      for (const filename of files) {
        if (!filename.endsWith('.json')) continue;
        const fullPath = path.join(subdirPath, filename);
        try {
          const raw = await fs.readFile(fullPath, 'utf8');
          const parsed = JSON.parse(raw) as DocumentNotesFileV1;
          out.push({
            repositoryPath: parsed.repositoryPath,
            relativeFilePath: parsed.relativeFilePath,
            fileHash: filename.replace(/\.json$/, ''),
            noteCount: parsed.notes?.length ?? 0,
            updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
            sizeBytes: Buffer.byteLength(raw, 'utf8'),
          });
        } catch (err) {
          console.warn(
            '[DocumentNotesPersistence] skipping unparseable file',
            fullPath,
            err,
          );
        }
      }
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return out;
  }

  /**
   * Read-modify-write a single notes file under the write queue. Mutator
   * receives the current notes array and returns the next array plus an
   * arbitrary result to surface to the caller. If the result array is empty,
   * the on-disk file is removed.
   */
  private async applyToFile<T>(
    repositoryPath: string | undefined,
    relativeFilePath: string,
    mutator: (
      existing: DocumentNote[],
    ) => { notes: DocumentNote[]; result: T },
  ): Promise<T> {
    let outResult!: T;
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        const file = this.filePathOf(repositoryPath, relativeFilePath);
        let existingFile: DocumentNotesFileV1 | null = null;
        try {
          const raw = await fs.readFile(file, 'utf8');
          existingFile = JSON.parse(raw) as DocumentNotesFileV1;
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code !== 'ENOENT') {
            console.warn(
              '[DocumentNotesPersistence] read-before-write failed, recreating',
              file,
              err,
            );
          }
        }
        const existingNotes = existingFile?.notes ?? [];
        const { notes, result } = mutator(existingNotes);
        outResult = result;

        if (notes.length === 0 && !existingFile) return;

        if (notes.length === 0) {
          try {
            await fs.unlink(file);
          } catch (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code !== 'ENOENT') {
              console.error(
                '[DocumentNotesPersistence] failed to remove empty notes file',
                file,
                err,
              );
            }
          }
          return;
        }

        const now = new Date().toISOString();
        const next: DocumentNotesFileV1 = {
          version: 1,
          repositoryPath,
          relativeFilePath,
          notes,
          createdAt: existingFile?.createdAt ?? now,
          updatedAt: now,
        };

        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf8');
      });
    await this.writeQueue;
    return outResult;
  }
}

let singleton: DocumentNotesPersistence | null = null;

export function getDocumentNotesPersistence(): DocumentNotesPersistence {
  if (!singleton) {
    singleton = new DocumentNotesPersistence();
  }
  return singleton;
}

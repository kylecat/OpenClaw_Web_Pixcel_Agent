import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { readdir, stat, readFile } from 'node:fs/promises';
import { resolve, join, extname, basename } from 'node:path';

/** Whitelisted root directories keyed by a short alias. */
const ALLOWED_ROOTS: Record<string, string> = {
  research: '/home/jetson/Desktop/OpenClaw_MCP/ResearchLog',
  data: resolve(__dirname, '../../../data'),
  devdocs: resolve(__dirname, '../../../DevDocuments'),
  skills: '/home/jetson/.openclaw/workspace-gaia/skills',
};

/** File extensions allowed for content preview. */
const PREVIEWABLE_EXTS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml',
  '.ts', '.js', '.log', '.csv', '.toml',
]);

/** Max file size in bytes for content preview (500 KB). */
const MAX_FILE_SIZE = 500 * 1024;

export interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
  modifiedAt: string;
}

export interface FileContent {
  name: string;
  content: string;
  size: number;
  modifiedAt: string;
}

@Injectable()
export class ShelfService {
  /** Resolve and validate a path stays inside the allowed root. */
  private safePath(rootKey: string, sub?: string): string {
    const root = ALLOWED_ROOTS[rootKey];
    if (!root) throw new ForbiddenException(`Unknown root: ${rootKey}`);
    if (!sub) return root;
    const resolved = resolve(root, sub);
    if (!resolved.startsWith(root)) {
      throw new ForbiddenException('Path traversal not allowed');
    }
    return resolved;
  }

  /** List files and directories under a root + optional sub-path. */
  async listFiles(rootKey: string, sub?: string): Promise<FileEntry[]> {
    const dir = this.safePath(rootKey, sub);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      throw new NotFoundException(`Directory not found: ${sub ?? rootKey}`);
    }

    const result: FileEntry[] = [];
    for (const name of entries) {
      if (name.startsWith('.')) continue; // skip hidden files
      try {
        const s = await stat(join(dir, name));
        result.push({
          name,
          isDir: s.isDirectory(),
          size: s.size,
          modifiedAt: s.mtime.toISOString(),
        });
      } catch {
        // skip files we can't stat
      }
    }

    // Directories first, then files alphabetically
    result.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  /** Read a single file's content for preview. */
  async readFileContent(rootKey: string, filePath: string): Promise<FileContent> {
    if (!filePath) throw new ForbiddenException('File path is required');
    const fullPath = this.safePath(rootKey, filePath);

    let s;
    try {
      s = await stat(fullPath);
    } catch {
      throw new NotFoundException(`File not found: ${filePath}`);
    }

    if (s.isDirectory()) {
      throw new ForbiddenException('Cannot preview a directory');
    }

    const ext = extname(fullPath).toLowerCase();
    if (!PREVIEWABLE_EXTS.has(ext)) {
      throw new ForbiddenException(`File type ${ext} is not previewable`);
    }

    if (s.size > MAX_FILE_SIZE) {
      throw new ForbiddenException(
        `File too large (${(s.size / 1024).toFixed(0)} KB, max ${MAX_FILE_SIZE / 1024} KB)`,
      );
    }

    const content = await readFile(fullPath, 'utf-8');

    return {
      name: basename(fullPath),
      content,
      size: s.size,
      modifiedAt: s.mtime.toISOString(),
    };
  }
}

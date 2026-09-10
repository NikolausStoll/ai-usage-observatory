import { promises as fs } from "fs";
import { join, dirname } from "path";

export interface ArtifactStorage {
  store(key: string, data: Buffer): Promise<void>;
  retrieve(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class FileSystemArtifactStorage implements ArtifactStorage {
  constructor(private readonly baseDir: string) {}

  private fullPath(key: string): string {
    return join(this.baseDir, key);
  }

  async store(key: string, data: Buffer): Promise<void> {
    const path = this.fullPath(key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, data);
  }

  async retrieve(key: string): Promise<Buffer> {
    const data = await fs.readFile(this.fullPath(key));
    return Buffer.from(data);
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.fullPath(key));
  }
}

let _storage: ArtifactStorage | null = null;

export function getArtifactStorage(): ArtifactStorage {
  if (!_storage) {
    const dataDir = process.env["DATA_DIR"] ?? "./data";
    _storage = new FileSystemArtifactStorage(join(dataDir, "artifacts"));
  }
  return _storage;
}

export function setArtifactStorage(storage: ArtifactStorage): void {
  _storage = storage;
}

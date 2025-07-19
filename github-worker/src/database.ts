
import { RepositoryFile, DatabaseRecord } from './types';

export class GitHubDatabase {
  private storage: any;

  constructor(state: any) {
    this.storage = state.storage;
    this.initializeDatabase();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean);

    if (request.method === 'POST' && path[0] === 'upsert') {
      const body = await request.json();
      const { files, repository, versioned = true } = body;
      
      for (const file of files) {
        await this.upsertFile(file, repository, versioned);
      }
      
      return new Response(JSON.stringify({ success: true, count: files.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'GET' && path[0] === 'files') {
      const repository = url.searchParams.get('repository');
      if (!repository) {
        return new Response(JSON.stringify({ error: 'Repository parameter required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const files = await this.getRepositoryFiles(repository);
      return new Response(JSON.stringify(files), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }

  private async initializeDatabase() {
    try {
      if (this.storage && this.storage.sql) {
        this.storage.sql.exec(`
          CREATE TABLE IF NOT EXISTS repository_files (
            id TEXT PRIMARY KEY,
            repository TEXT NOT NULL,
            file_path TEXT NOT NULL,
            content TEXT NOT NULL,
            sha TEXT NOT NULL,
            version INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(repository, file_path, version)
          )
        `);

        this.storage.sql.exec(`
          CREATE INDEX IF NOT EXISTS idx_repo_path ON repository_files (repository, file_path)
        `);

        this.storage.sql.exec(`
          CREATE INDEX IF NOT EXISTS idx_repo_version ON repository_files (repository, version)
        `);
      }
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  async upsertFile(file: RepositoryFile, repository: string, versioned: boolean = true): Promise<void> {
    try {
      const id = crypto.randomUUID();
      const now = Date.now();
      
      if (versioned) {
        const currentVersion = await this.getCurrentVersion(repository, file.path);
        const newVersion = currentVersion + 1;
        
        this.storage.sql.exec(`
          INSERT INTO repository_files (id, repository, file_path, content, sha, version, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, id, repository, file.path, file.content, file.sha, newVersion, now, now);
      } else {
        this.storage.sql.exec(`
          DELETE FROM repository_files WHERE repository = ? AND file_path = ?
        `, repository, file.path);
        
        this.storage.sql.exec(`
          INSERT INTO repository_files (id, repository, file_path, content, sha, version, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `, id, repository, file.path, file.content, file.sha, now, now);
      }
    } catch (error) {
      console.error('Error upserting file:', error);
      throw error;
    }
  }

  private async getCurrentVersion(repository: string, filePath: string): Promise<number> {
    try {
      const result = this.storage.sql.exec(`
        SELECT MAX(version) as max_version FROM repository_files 
        WHERE repository = ? AND file_path = ?
      `, repository, filePath);
      
      const row = result.next();
      return row.value?.max_version || 0;
    } catch (error) {
      console.error('Error getting current version:', error);
      return 0;
    }
  }

  private async getRepositoryFiles(repository: string): Promise<DatabaseRecord[]> {
    try {
      const cursor = this.storage.sql.exec(`
        SELECT * FROM repository_files 
        WHERE repository = ? 
        ORDER BY file_path, version DESC
      `, repository);

      const files: DatabaseRecord[] = [];
      let result = cursor.next();

      while (!result.done && result.value) {
        files.push(result.value);
        result = cursor.next();
      }

      return files;
    } catch (error) {
      console.error('Error getting repository files:', error);
      return [];
    }
  }
}

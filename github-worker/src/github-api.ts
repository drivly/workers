import { RepositoryFile, GitHubContentItem } from './types';

export class GitHubAPI {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  async fetchRepositoryFiles(owner: string, repo: string, ref: string = 'main'): Promise<RepositoryFile[]> {
    const files: RepositoryFile[] = [];
    await this.fetchFilesRecursive(owner, repo, '', ref, files);
    return files.filter(file => file.path.endsWith('.md') || file.path.endsWith('.mdx'));
  }

  private async fetchFilesRecursive(
    owner: string, 
    repo: string, 
    path: string, 
    ref: string, 
    files: RepositoryFile[]
  ): Promise<void> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
    const response = await this.makeRequest(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Path not found: ${path} in ${owner}/${repo}`);
        return;
      }
      throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
    }
    
    const contents = await response.json();
    const items = Array.isArray(contents) ? contents : [contents];
    
    for (const item of items) {
      if (item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.mdx'))) {
        try {
          const fileContent = await this.fetchFileContent(item.download_url);
          files.push({
            path: item.path,
            content: fileContent,
            sha: item.sha,
            size: item.size
          });
        } catch (error) {
          console.error(`Failed to fetch file content for ${item.path}:`, error);
        }
      } else if (item.type === 'dir') {
        await this.fetchFilesRecursive(owner, repo, item.path, ref, files);
      }
    }
  }

  private async fetchFileContent(downloadUrl: string): Promise<string> {
    const response = await this.makeRequest(downloadUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file content: ${response.status} - ${response.statusText}`);
    }
    
    return await response.text();
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const maxRetries = 3;
    const retryDelay = 1000;
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'GitHub-Worker/1.0',
            ...options.headers
          }
        });

        if (response.ok || response.status < 500) {
          return response;
        }

        lastError = new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      attempt++;
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Failed to make GitHub API request after multiple attempts');
  }
}

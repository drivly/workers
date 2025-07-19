
export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
  DB: any;
}

export interface GitHubWebhookPayload {
  action?: string;
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
    default_branch: string;
  };
  ref?: string;
  head_commit?: {
    id: string;
  };
  pull_request?: {
    head: {
      sha: string;
      ref: string;
    };
  };
}

export interface RepositoryFile {
  path: string;
  content: string;
  sha: string;
  size: number;
}

export interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size: number;
  download_url: string;
}

export interface DatabaseRecord {
  id: string;
  repository: string;
  file_path: string;
  content: string;
  sha: string;
  version: number;
  created_at: number;
  updated_at: number;
}

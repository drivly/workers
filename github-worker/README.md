# GitHub Worker

A Cloudflare Worker that processes GitHub webhooks to fetch and store markdown files from repositories.

## Features

- Receives GitHub webhooks for push and pull request events
- Fetches all `.md` and `.mdx` files from the repository using GitHub API
- Stores files in a durable object database with versioned upsert functionality
- Verifies webhook signatures for security using HMAC-SHA256
- Handles GitHub API rate limiting with exponential backoff retry logic
- Processes repository files recursively through directory structures

## Configuration

### Environment Variables

- `GITHUB_TOKEN`: GitHub personal access token or GitHub App token for API access
- `GITHUB_WEBHOOK_SECRET`: Secret for verifying webhook signatures (must match GitHub webhook configuration)

### Webhook Setup

Configure your GitHub repository to send webhooks to:
```
https://your-worker-domain.workers.dev/webhook
```

Events to subscribe to:
- `push` - Processes all pushes to any branch
- `pull_request` - Processes opened and synchronized pull requests

Content type: `application/json`

## Development

```bash
# Install dependencies
pnpm install

# Run locally (requires wrangler)
pnpm dev

# Build check
pnpm build

# Deploy to Cloudflare
pnpm deploy
```

## API Endpoints

- `POST /webhook` - Receives GitHub webhooks and processes repository files
- `GET /` - Health check endpoint returning worker status

## Database Schema

The worker stores files in a durable object with the following schema:

```sql
CREATE TABLE repository_files (
  id TEXT PRIMARY KEY,
  repository TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  sha TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(repository, file_path, version)
);

CREATE INDEX idx_repo_path ON repository_files (repository, file_path);
CREATE INDEX idx_repo_version ON repository_files (repository, version);
```

## Architecture

The worker follows a modular architecture:

- **Main Handler** (`src/index.ts`): Routes requests and orchestrates webhook processing
- **GitHub API Client** (`src/github-api.ts`): Handles GitHub API interactions with retry logic
- **Database Layer** (`src/database.ts`): Manages durable object storage and versioned upserts
- **Webhook Processing** (`src/webhook.ts`): Validates signatures and extracts repository information
- **Type Definitions** (`src/types.ts`): Shared interfaces and type definitions

## Usage Flow

1. GitHub sends webhook to `/webhook` endpoint
2. Worker verifies webhook signature using HMAC-SHA256
3. Worker extracts repository information from webhook payload
4. Worker fetches all `.md` and `.mdx` files from repository using GitHub API
5. Worker stores files in durable object database with version tracking
6. Worker returns success response to GitHub

## Error Handling

- Invalid webhook signatures return 401 Unauthorized
- Missing GitHub tokens or API errors are logged and return 500 Internal Server Error
- Database errors are caught and logged with appropriate error responses
- GitHub API rate limiting is handled with exponential backoff retry logic

## Security

- Webhook signatures are verified using HMAC-SHA256 with the configured secret
- GitHub API requests use Bearer token authentication
- All secrets are stored as environment variables, never in code
- Database operations use parameterized queries to prevent injection attacks

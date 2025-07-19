
import { Env, GitHubWebhookPayload } from './types';
import { GitHubAPI } from './github-api';
import { GitHubDatabase } from './database';
import { verifyWebhookSignature, extractRepositoryInfo, shouldProcessEvent } from './webhook';

export { GitHubDatabase };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.method === 'POST' && url.pathname === '/webhook') {
      return handleGitHubWebhook(request, env);
    }
    
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('GitHub Worker - Ready to receive webhooks', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function handleGitHubWebhook(request: Request, env: Env): Promise<Response> {
  try {
    const signature = request.headers.get('x-hub-signature-256');
    const eventType = request.headers.get('x-github-event');
    const payload = await request.text();
    
    if (!eventType) {
      return new Response('Missing GitHub event type', { status: 400 });
    }

    if (!await verifyWebhookSignature(payload, signature, env.GITHUB_WEBHOOK_SECRET)) {
      console.error('Invalid webhook signature');
      return new Response('Unauthorized', { status: 401 });
    }

    const webhookData: GitHubWebhookPayload = JSON.parse(payload);
    
    if (!shouldProcessEvent(eventType, webhookData)) {
      return new Response('Event not processed', { status: 200 });
    }

    const repoInfo = extractRepositoryInfo(webhookData, eventType);
    if (!repoInfo) {
      return new Response('Invalid repository information', { status: 400 });
    }

    await processRepositoryEvent(repoInfo, env);
    
    return new Response('Webhook processed successfully', { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function processRepositoryEvent(
  repoInfo: { owner: string; repo: string; ref: string },
  env: Env
): Promise<void> {
  try {
    const githubApi = new GitHubAPI(env.GITHUB_TOKEN);
    const files = await githubApi.fetchRepositoryFiles(repoInfo.owner, repoInfo.repo, repoInfo.ref);
    
    if (files.length === 0) {
      console.log(`No .md or .mdx files found in ${repoInfo.owner}/${repoInfo.repo}`);
      return;
    }

    const dbId = env.DB.idFromName('github-files');
    const dbStub = env.DB.get(dbId);
    
    const response = await dbStub.fetch('http://localhost/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files,
        repository: `${repoInfo.owner}/${repoInfo.repo}`,
        versioned: true
      })
    });

    if (!response.ok) {
      throw new Error(`Database upsert failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Successfully processed ${result.count} files for ${repoInfo.owner}/${repoInfo.repo}`);
  } catch (error) {
    console.error('Error processing repository event:', error);
    throw error;
  }
}

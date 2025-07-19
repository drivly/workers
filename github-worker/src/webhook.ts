import { GitHubWebhookPayload } from './types';

export async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

export function extractRepositoryInfo(payload: GitHubWebhookPayload, eventType: string): {
  owner: string;
  repo: string;
  ref: string;
} | null {
  if (!payload.repository) {
    return null;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  let ref = payload.repository.default_branch;

  if (eventType === 'push' && payload.ref) {
    ref = payload.ref.replace('refs/heads/', '');
  } else if (eventType === 'pull_request' && payload.pull_request) {
    ref = payload.pull_request.head.sha;
  }

  return { owner, repo, ref };
}

export function shouldProcessEvent(eventType: string, payload: GitHubWebhookPayload): boolean {
  if (eventType === 'push') {
    return true;
  }
  
  if (eventType === 'pull_request') {
    return payload.action === 'opened' || payload.action === 'synchronize';
  }
  
  return false;
}

import { GitHubWebhookPayload } from './types';
import { extractRepositoryInfo, shouldProcessEvent } from './webhook';

const testPushPayload: GitHubWebhookPayload = {
  repository: {
    name: 'test-repo',
    full_name: 'owner/test-repo',
    owner: {
      login: 'owner'
    },
    default_branch: 'main'
  },
  ref: 'refs/heads/main',
  head_commit: {
    id: 'abc123'
  }
};

const testPRPayload: GitHubWebhookPayload = {
  action: 'opened',
  repository: {
    name: 'test-repo',
    full_name: 'owner/test-repo',
    owner: {
      login: 'owner'
    },
    default_branch: 'main'
  },
  pull_request: {
    head: {
      sha: 'def456',
      ref: 'feature-branch'
    }
  }
};

console.log('Testing webhook processing...');
console.log('Should process push event:', shouldProcessEvent('push', testPushPayload));
console.log('Should process PR event:', shouldProcessEvent('pull_request', testPRPayload));
console.log('Push repository info:', extractRepositoryInfo(testPushPayload, 'push'));
console.log('PR repository info:', extractRepositoryInfo(testPRPayload, 'pull_request'));

export { testPushPayload, testPRPayload };

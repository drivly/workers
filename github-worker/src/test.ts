import { GitHubAPI } from './github-api';
import { verifyWebhookSignature, extractRepositoryInfo, shouldProcessEvent } from './webhook';

const testPayload = {
  repository: {
    name: 'test-repo',
    full_name: 'owner/test-repo',
    owner: {
      login: 'owner'
    },
    default_branch: 'main'
  },
  ref: 'refs/heads/main'
};

console.log('Testing webhook processing...');
console.log('Should process push event:', shouldProcessEvent('push', testPayload));
console.log('Repository info:', extractRepositoryInfo(testPayload, 'push'));

console.log('GitHub worker test completed');

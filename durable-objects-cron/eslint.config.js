import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Add specific rules or overrides for 'durable-objects-cron' if needed
    // languageOptions: {
    //   globals: {
    //     // ...globals.serviceworker, // For Cloudflare Worker globals
    //   }
    // }
  }
);

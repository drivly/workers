import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Add specific rules or overrides for 'deploy-worker' if needed
    // languageOptions: {
    //   globals: {
    //     // node: true, // if this is primarily a Node.js tool
    //   }
    // }
  }
);

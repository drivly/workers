import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // You can add specific rules or overrides here if needed.
    // For example, to set up globals for Cloudflare Workers:
    // languageOptions: {
    //   globals: {
    //     ...globals.serviceworker, // if using 'globals' package
    //     // Add any custom globals specific to your DO environment
    //     // MyDurableObject: 'readonly', 
    //   }
    // },
    rules: {
      // Example: If you want to allow 'any' type, you could set:
      // "@typescript-eslint/no-explicit-any": "off", 
    }
  }
);

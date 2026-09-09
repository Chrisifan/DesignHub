import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.vite', 'node_modules', 'dist', 'out', '.superpowers'] },
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', '*.config.ts', 'forge.config.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
);

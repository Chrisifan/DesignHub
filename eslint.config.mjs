import tseslint from 'typescript-eslint';

/** @type {import('eslint').Rule.RuleModule} */
export const arrowFunctionRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require self-authored functions to use const arrow syntax.' },
    schema: [],
    messages: {
      functionDeclaration: 'Use a const arrow function instead of a function declaration.',
      functionExpression: 'Use an arrow function instead of a function expression.',
      objectMethod: 'Use arrow-function properties instead of object method shorthand.',
      classMethod: 'Class methods and constructors are not allowed in self-authored code.',
    },
  },
  create: (context) => ({
    FunctionDeclaration: (node) => {
      context.report({ node, messageId: 'functionDeclaration' });
    },
    FunctionExpression: (node) => {
      if (node.parent.type === 'Property' && node.parent.method) return;
      if (node.parent.type === 'MethodDefinition') return;
      context.report({ node, messageId: 'functionExpression' });
    },
    Property: (node) => {
      if (node.method) context.report({ node, messageId: 'objectMethod' });
    },
    MethodDefinition: (node) => {
      context.report({ node, messageId: 'classMethod' });
    },
  }),
};

const arrowFunctionConfig = {
  plugins: { designhub: { rules: { 'arrow-functions': arrowFunctionRule } } },
  rules: { 'designhub/arrow-functions': 'error' },
};

export default tseslint.config(
  { ignores: ['.vite', 'node_modules', 'dist', 'out', '.superpowers', 'tests/fixtures/lint'] },
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', '*.config.ts', '*.config.mjs', 'eslint.config.mjs', 'forge.config.ts'],
    ...arrowFunctionConfig,
    rules: {
      ...arrowFunctionConfig.rules,
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'electron', message: 'Renderer code must use the typed preload facade.' }],
          patterns: [
            { group: ['node:*'], message: 'Renderer code cannot import Node built-ins.' },
            { group: ['../desktop/**', '../../desktop/**', 'src/desktop/**'], message: 'Renderer code cannot import desktop implementation modules.' },
          ],
        },
      ],
    },
  }
);

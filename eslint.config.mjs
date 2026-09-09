import { builtinModules } from 'node:module';

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
      mutableArrow: 'Arrow functions must be assigned with const.',
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
    TSDeclareFunction: (node) => {
      context.report({ node, messageId: 'functionDeclaration' });
    },
    TSAbstractMethodDefinition: (node) => {
      context.report({ node, messageId: 'classMethod' });
    },
    VariableDeclaration: (node) => {
      if (node.kind !== 'const' && node.declarations.some(({ init }) => init?.type === 'ArrowFunctionExpression')) {
        context.report({ node, messageId: 'mutableArrow' });
      }
    },
  }),
};

const projectRules = {
  plugins: { designhub: { rules: { 'arrow-functions': arrowFunctionRule } } },
  rules: { 'designhub/arrow-functions': 'error' },
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nodeBuiltinRegex = `^(?:node:)?(?:${builtinModules.map(escapeRegex).join('|')})(?:/.*)?$`;

export default tseslint.config(
  { ignores: ['.vite', 'node_modules', 'dist', 'out', '.superpowers', 'tests/fixtures/lint/declaration-invalid.ts'] },
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', '*.config.ts', '*.config.mjs', 'eslint.config.mjs', 'forge.config.ts'],
    ...projectRules,
    rules: {
      ...projectRules.rules,
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: nodeBuiltinRegex, message: 'Renderer code cannot import Node built-ins.' },
            { regex: '^electron(?:/.*)?$', message: 'Renderer code must use the typed preload facade.' },
            { regex: '^\\.{1,2}(?:/\\.{1,2})*/desktop(?:/.*)?$', message: 'Renderer code cannot import desktop implementation modules.' },
            { regex: '^src/desktop(?:/.*)?$', message: 'Renderer code cannot import desktop implementation modules.' },
          ],
        },
      ],
    },
  }
);

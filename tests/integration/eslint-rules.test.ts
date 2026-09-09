import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ESLint } from 'eslint';
import { expect, it } from 'vitest';

const lintFixture = async (fixtureName: string, filePath: string) => {
  const source = await readFile(resolve(process.cwd(), 'tests/fixtures/lint', fixtureName), 'utf8');
  const eslint = new ESLint({ overrideConfigFile: 'eslint.config.mjs' });
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages;
};

it('allows arrow functions and rejects other self-authored function forms', async () => {
  const validMessages = await lintFixture('arrow-valid.ts', 'src/shared/arrow-valid.ts');
  const invalidMessages = await lintFixture('declaration-invalid.ts', 'src/shared/declaration-invalid.ts');

  expect(validMessages).toEqual([]);
  const projectRuleMessages = invalidMessages.filter(({ ruleId }) => ruleId === 'designhub/arrow-functions');

  expect(projectRuleMessages.map(({ message }) => message)).toEqual(expect.arrayContaining([
    'Use a const arrow function instead of a function declaration.',
    'Use an arrow function instead of a function expression.',
    'Arrow functions must be assigned with const.',
    'Use arrow-function properties instead of object method shorthand.',
    'Class methods and constructors are not allowed in self-authored code.',
  ]));
  expect(projectRuleMessages.filter(({ message }) => message === 'Arrow functions must be assigned with const.')).toHaveLength(3);
});

it('rejects desktop runtime and Node imports from renderer application code', async () => {
  const eslint = new ESLint({ overrideConfigFile: 'eslint.config.mjs' });
  const source = [
    "import { ipcRenderer } from 'electron';",
    "import 'electron/main';",
    "import { readFile } from 'node:fs/promises';",
    "import 'fs';",
    "import { createWindowOptions } from '../desktop/window-options';",
    "import '../../../desktop/window-options';",
    "import './feature/../desktop/window-options';",
    "import '../platform/desktop';",
    "import '../platform/desktop/../../desktop/window-options';",
    "import './feature/../../platform/desktop/../../desktop/window-options';",
  ].join('\n');
  const [result] = await eslint.lintText(source, { filePath: 'src/app/renderer-boundary.ts' });

  expect(result.messages.filter(({ ruleId }) => ruleId === 'no-restricted-imports')).toHaveLength(9);
});

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const sourceRoot = join(root, 'src');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const forbiddenProductSymbols = [
  ['document', 'Id'].join(''),
  'documentEntries',
  'loadDocumentScene',
  'saveDocumentScene',
  'createDocument',
  'listDocuments',
  'commitRevision',
  'finalizeRevision',
  'listRevisions',
  'brandSnapshot',
];
const removedFocusedPatterns = [/(^|\/)Workbench\.test\./u, /(^|\/)scenes?\.test\./u, /(^|\/)revisions?\.test\./u, /(^|\/)brands?\.test\./u];

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return walk(path);
  return sourceExtensions.has(extname(entry.name)) ? [path] : [];
});

const violations = [];
const productFiles = walk(sourceRoot).filter((path) => !/\.test\.[^.]+$/u.test(path));
for (const path of productFiles) {
  const content = readFileSync(path, 'utf8');
  for (const symbol of forbiddenProductSymbols) {
    if (content.includes(symbol)) violations.push(`${relative(root, path)} contains removed product symbol ${symbol}`);
  }
}

const removedDocumentId = ['document', 'Id'].join('');
const migrationFixtureRoot = join(root, 'tests', 'fixtures', 'migrations');
for (const directory of [sourceRoot, join(root, 'tests')]) {
  for (const path of walk(directory)) {
    if (path.startsWith(migrationFixtureRoot)) continue;
    if (readFileSync(path, 'utf8').includes(removedDocumentId)) violations.push(`${relative(root, path)} contains ${removedDocumentId} outside migration fixtures`);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const focused = String(packageJson.scripts?.['test:focused'] ?? '');
const focusedPaths = focused.split(/\s+/u).filter((entry) => /\.(?:ts|tsx|js|jsx)$/u.test(entry) && entry !== 'vitest.config.ts');
for (const path of focusedPaths) {
  if (!existsSync(join(root, path))) violations.push(`test:focused references missing file ${path}`);
  if (removedFocusedPatterns.some((pattern) => pattern.test(path))) violations.push(`test:focused references removed V1 suite ${path}`);
}

const supersededDocuments = [
  'docs/superpowers/specs/2026-09-08-designhub-v1-design.md',
  'docs/superpowers/plans/2026-09-08-designhub-v1.md',
  'docs/adr/0004-immutable-design-revisions.md',
  'docs/adr/0007-revision-level-creative-attribution.md',
  'docs/adr/0008-multi-document-design-projects.md',
  'docs/adr/0014-conversation-and-tools-share-revision-history.md',
];
for (const path of supersededDocuments) {
  const heading = readFileSync(join(root, path), 'utf8').slice(0, 800);
  if (!/superseded/iu.test(heading)) violations.push(`${path} is missing a superseded notice`);
}

if (violations.length > 0) {
  process.stderr.write(`${violations.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`V1 contract scan passed (${productFiles.length} product files, ${focusedPaths.length} focused tests).\n`);
}

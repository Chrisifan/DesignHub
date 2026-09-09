import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.resolve(import.meta.dirname, '..');
const ignoredEntries = new Set(['node_modules', 'pnpm-lock.yaml']);
const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const childLists = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);

    if (ignoredEntries.has(entry.name)) {
      return [];
    }

    if (entry.isDirectory()) {
      return collectFiles(entryPath);
    }

    return /\.(?:mjs|html)$/.test(entry.name) ? [entryPath] : [];
  }));

  return childLists.flat();
};
const files = await collectFiles(sourceRoot);
const violations = [];

for (const filePath of files) {
  const source = await readFile(filePath, 'utf8');
  const functionMatches = source.match(/\bfunction\b/g) ?? [];

  if (functionMatches.length > 0) {
    violations.push(`${path.relative(sourceRoot, filePath)}: ${functionMatches.length} disallowed declaration marker occurrence(s)`);
  }
}

if (violations.length > 0) {
  throw new Error(violations.join('\n'));
}

console.log(`arrow-style check passed for ${files.length} self-authored probe source file(s)`);

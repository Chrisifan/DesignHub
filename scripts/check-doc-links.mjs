import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const docsRoot = join(root, 'docs');

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return walk(path);
  return extname(entry.name) === '.md' ? [path] : [];
});

const markdownFiles = [join(root, 'CONTEXT.md'), ...walk(docsRoot)];
const failures = [];
for (const path of markdownFiles) {
  const content = readFileSync(path, 'utf8').replace(/```[\s\S]*?```/gu, '');
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const rawTarget = match[1]?.trim() ?? '';
    const target = rawTarget.startsWith('<') && rawTarget.endsWith('>') ? rawTarget.slice(1, -1) : rawTarget;
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/iu.test(target)) continue;
    const pathPart = decodeURIComponent(target.split('#')[0] ?? '');
    if (!pathPart) continue;
    const resolved = resolve(dirname(path), pathPart);
    if (!existsSync(resolved)) failures.push(`${relative(root, path)} -> ${target}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Broken documentation links:\n${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Documentation link check passed (${markdownFiles.length} files).\n`);
}

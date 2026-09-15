import { expect, it } from 'vitest';
import { classifyPackageEntry, createPackageClosureReport, deliveryEntries, isSafePackagePath } from './package-policy';

it('只读交付只带输出预览清单，排除内部对话密钥字体', () => {
  expect(deliveryEntries([
    { path: 'poster.png', kind: 'output' },
    { path: 'delivery.json', kind: 'manifest' },
    { path: 'conversation.json', kind: 'conversation' },
    { path: 'key.txt', kind: 'credential' },
    { path: 'brand.ttf', kind: 'font' },
  ])).toEqual(['poster.png', 'delivery.json']);
});

it('rejects traversal and absolute package paths', () => {
  expect(isSafePackagePath('../key.txt')).toBe(false);
  expect(isSafePackagePath('/tmp/key.txt')).toBe(false);
  expect(isSafePackagePath('assets/poster.png')).toBe(true);
  expect(isSafePackagePath('assets//poster.png')).toBe(false);
  expect(isSafePackagePath('C:/Users/name/poster.png')).toBe(false);
  expect(isSafePackagePath('assets/poster.png/')).toBe(false);
});

it('classifies project files so read-only delivery excludes private content', () => {
  expect(classifyPackageEntry('exports/poster.png')).toBe('output');
  expect(classifyPackageEntry('previews/poster.png')).toBe('preview');
  expect(classifyPackageEntry('conversation/history.json')).toBe('conversation');
  expect(classifyPackageEntry('fonts/brand.ttf')).toBe('font');
  expect(classifyPackageEntry('credentials.json')).toBe('credential');
  expect(classifyPackageEntry('documents/doc-1.scene.json')).toBe('manifest');
});

it('classifies unarchived reference materials so they stay outside project packages', () => {
  expect(classifyPackageEntry('references/portfolio/source.png')).toBe('reference');
  expect(createPackageClosureReport([
    { path: 'references/portfolio/source.png', kind: 'reference' },
  ])).toEqual({
    included: [],
    excluded: [{ path: 'references/portfolio/source.png', kind: 'reference', reason: 'not-delivery' }],
  });
});

it('reports included and excluded package entries without losing exclusion reasons', () => {
  const report = createPackageClosureReport([
    { path: 'project.json', kind: 'manifest' },
    { path: 'conversation/history.json', kind: 'conversation' },
    { path: 'fonts/brand.ttf', kind: 'font' },
    { path: '../escape.txt', kind: 'manifest' },
  ], true);

  expect(report.included).toEqual([{ path: 'project.json', kind: 'manifest' }]);
  expect(report.excluded).toEqual(expect.arrayContaining([
    { path: 'conversation/history.json', kind: 'conversation', reason: 'not-delivery' },
    { path: 'fonts/brand.ttf', kind: 'font', reason: 'private' },
    { path: '../escape.txt', kind: 'manifest', reason: 'unsafe-path' },
  ]));
});

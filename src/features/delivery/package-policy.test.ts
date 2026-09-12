import { expect, it } from 'vitest';
import { classifyPackageEntry, deliveryEntries, isSafePackagePath } from './package-policy';

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
});

it('classifies project files so read-only delivery excludes private content', () => {
  expect(classifyPackageEntry('exports/poster.png')).toBe('output');
  expect(classifyPackageEntry('previews/poster.png')).toBe('preview');
  expect(classifyPackageEntry('conversation/history.json')).toBe('conversation');
  expect(classifyPackageEntry('fonts/brand.ttf')).toBe('font');
  expect(classifyPackageEntry('credentials.json')).toBe('credential');
  expect(classifyPackageEntry('documents/doc-1.scene.json')).toBe('manifest');
});

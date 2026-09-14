import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const readStyle = (file: string): string =>
  readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

it('defines shared layout tokens for compact toolbar controls and unframed main content', () => {
  const tokens = readStyle('../../src/app/styles/tokens.css');

  expect(tokens).toMatch(/--toolbar-control-height:\s*28px/);
  expect(tokens).toMatch(/--toolbar-control-padding-inline:\s*8px/);
  expect(tokens).toMatch(/--content-card-background:\s*transparent/);
  expect(tokens).toMatch(/--content-card-radius:\s*0/);
  expect(tokens).toMatch(/--content-card-shadow:\s*none/);
  expect(tokens).toMatch(/--scrollbar-size:\s*6px/);
  expect(tokens).toMatch(/--scrollbar-thumb:/);
  expect(tokens).toMatch(/--scrollbar-thumb-hover:/);
});

it('keeps regular studio pages on one scroll owner and styles compact toolbar actions', () => {
  const styles = readStyle('../../src/app/styles/studio.css');
  const libraryStyles = readStyle('../../src/app/studio/library.css');

  expect(styles).toMatch(
    /\.studio-body\s*\{[\s\S]*overflow:\s*hidden;/,
  );
  expect(styles).toMatch(
    /\.page-content\s*\{[\s\S]*overflow-y:\s*auto;/,
  );
  expect(styles).toMatch(
    /\.toolbar-actions \.ui-button\s*\{[\s\S]*min-height:\s*var\(--toolbar-control-height\)/,
  );
  expect(styles).toMatch(
    /\.library-split,[\s\S]*\.connection-layout,[\s\S]*\.delivery-layout\s*\{[\s\S]*background:\s*var\(--content-card-background\)/,
  );
  expect(styles).toMatch(
    /\.library-split,[\s\S]*\.connection-layout,[\s\S]*\.delivery-layout\s*\{[\s\S]*border:\s*0;[\s\S]*border-radius:\s*var\(--content-card-radius\);[\s\S]*box-shadow:\s*var\(--content-card-shadow\)/,
  );
  expect(styles).toMatch(
    /\.project-card\s*\{[\s\S]*background:\s*var\(--surface-container-lowest\)/,
  );
  expect(libraryStyles).toMatch(
    /\.capability-matrix\s*\{[\s\S]*background:\s*transparent/,
  );
  expect(libraryStyles).toMatch(
    /\.delivery-preview\s*\{[\s\S]*background:\s*transparent/,
  );
  expect(libraryStyles).toMatch(
    /\.delivery-config\s*\{[\s\S]*background:\s*transparent/,
  );
});

it('keeps designer library scrolling inside its content panels', () => {
  const personaStyles = readStyle('../../src/app/studio/persona.css');

  expect(personaStyles).toMatch(
    /\.persona-repository__list\s*\{[\s\S]*overflow:\s*auto;/,
  );
  expect(personaStyles).toMatch(
    /\.persona-inspector\s*\{[\s\S]*overflow-y:\s*auto;/,
  );
  expect(personaStyles).toMatch(
    /\.page-content\.designer-library-page\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/,
  );
  expect(personaStyles).toMatch(
    /\.library-split--designer\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*height:\s*auto;[\s\S]*min-height:\s*0;/,
  );
});

it('prevents the designer page from creating document-level outer scroll', () => {
  const windowStyles = readStyle('../../src/app/styles/window.css');
  const studioStyles = readStyle('../../src/app/styles/studio.css');

  expect(windowStyles).toMatch(
    /html,\s*body,\s*#root\s*\{[^}]*overflow:\s*hidden;/,
  );
  expect(windowStyles).toMatch(
    /\.app-shell\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/,
  );
  expect(studioStyles).toMatch(
    /\.studio\s*\{[^}]*height:\s*calc\(100dvh - 40px\);[^}]*min-height:\s*0;/,
  );
});

it('fills library regions and keeps sibling content aligned', () => {
  const libraryStyles = readStyle('../../src/app/studio/library.css');

  expect(libraryStyles).toMatch(
    /\.library-page\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*min-height:\s*100%;/,
  );
  expect(libraryStyles).toMatch(
    /\.library-page\s*>\s*\.library-split,[\s\S]*\.connection-layout,[\s\S]*\.delivery-layout\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*min-height:\s*0;/,
  );
  expect(libraryStyles).toMatch(
    /\.asset-collection\s*\{[\s\S]*padding:\s*0 16px 16px 0;/,
  );
  expect(libraryStyles).toMatch(
    /\.brand-list\s*\{\s*padding:\s*0 12px 12px;/,
  );
  expect(libraryStyles).toMatch(
    /\.delivery-preview:not\(\.delivery-preview--empty\)\s*>\s*div:last-child/,
  );
  expect(libraryStyles).toMatch(
    /\.delivery-preview:not\(\.delivery-preview--empty\)\s+p\s*\{/,
  );
  expect(libraryStyles).toMatch(
    /\.delivery-preview--empty\s*>\s*\.empty-state\s*\{[\s\S]*width:\s*100%;/,
  );
  expect(libraryStyles).toMatch(
    /\.settings-layout\s*\{[\s\S]*border-top:\s*0;/,
  );
  expect(libraryStyles).toMatch(
    /\.settings-section:last-child\s*\{[\s\S]*border-bottom:\s*0;/,
  );
});

it('fills the model connection columns while keeping the right panel scrollable', () => {
  const libraryStyles = readStyle('../../src/app/studio/library.css');

  expect(libraryStyles).toMatch(
    /\.connection-layout\s*\{[\s\S]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/,
  );
  expect(libraryStyles).toMatch(
    /\.library-page\s*>\s*\.connection-layout\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/,
  );
  expect(libraryStyles).toMatch(
    /\.connection-layout\s*>\s*\.empty-state\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*1;[\s\S]*align-self:\s*stretch;/,
  );
  expect(libraryStyles).toMatch(
    /\.connection-layout\s*>\s*\.provider-settings\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*1\s*\/\s*span\s*2;/,
  );
  expect(libraryStyles).toMatch(
    /\.connection-layout\s*>\s*\.capability-matrix\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*2;/,
  );
  expect(libraryStyles).toMatch(
    /\.connection-layout\s*>\s*\.provider-settings\s*\{[\s\S]*overflow-y:\s*auto;/,
  );
  expect(libraryStyles).toMatch(
    /\.connection-layout\s*>\s*\.capability-matrix\s*\{[\s\S]*border-right:\s*1px\s+solid\s+var\(--border-subtle\);/,
  );
});

it('hides the backing select input text so the custom label is rendered once', () => {
  const styles = readStyle('../../src/app/styles/studio.css');

  expect(styles).toMatch(
    /\.ui-select__trigger\s*\{[\s\S]*color:\s*transparent\s*!important;[\s\S]*-webkit-text-fill-color:\s*transparent\s*!important;[\s\S]*text-indent:\s*-9999px;/,
  );
});

it('ships the save icon used by provider actions', () => {
  expect(existsSync('public/icons/save.svg')).toBe(true);
});

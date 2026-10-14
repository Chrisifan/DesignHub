import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const readStyle = (file: string): string =>
  readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

it('defines independent semantic colors in dark and light themes', () => {
  const tokens = readStyle('../../src/app/styles/tokens.css');
  const darkTheme = tokens.match(/:root,\s*:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const lightTheme = tokens.match(/:root\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const systemLightTheme = tokens.match(/:root:not\(\[data-theme='dark'\]\)\s*\{([\s\S]*?)\n  \}/u)?.[1] ?? '';

  expect(darkTheme).toMatch(/--success:\s*#4ade80/u);
  expect(darkTheme).toMatch(/--success-container:\s*#14532d/u);
  expect(darkTheme).toMatch(/--warning:\s*#fbbf24/u);
  expect(darkTheme).toMatch(/--error:\s*#fca5a5/u);
  expect(darkTheme).toMatch(/--info:\s*#93c5fd/u);
  expect(darkTheme).toMatch(/--accent-warm:\s*#fb923c/u);

  expect(lightTheme).toMatch(/--success:\s*#15803d/u);
  expect(lightTheme).toMatch(/--warning:\s*#a16207/u);
  expect(lightTheme).toMatch(/--error:\s*#b91c1c/u);
  expect(lightTheme).toMatch(/--info:\s*#1d4ed8/u);
  expect(lightTheme).toMatch(/--accent-warm:\s*#c2410c/u);
  expect(lightTheme).not.toMatch(/--success:\s*var\(--(?:primary|tertiary)\)/u);
  expect(systemLightTheme).toMatch(/--success:\s*#15803d/u);

  for (const theme of [darkTheme, lightTheme, systemLightTheme]) {
    for (const tone of ['success', 'warning', 'error', 'info']) {
      expect(theme).toMatch(new RegExp(`--on-${tone}:\\s*#[0-9a-f]{6}`, 'u'));
      expect(theme).toMatch(new RegExp(`--${tone}-container:\\s*#[0-9a-f]{6}`, 'u'));
      expect(theme).toMatch(new RegExp(`--on-${tone}-container:\\s*#[0-9a-f]{6}`, 'u'));
    }
  }
});

it('uses semantic colors for status UI without consuming brand or decorative accents', () => {
  const studioStyles = readStyle('../../src/app/styles/studio.css');
  const libraryStyles = readStyle('../../src/app/studio/library.css');
  const personaStyles = readStyle('../../src/app/studio/persona.css');
  const workbenchStyles = readStyle('../../src/app/studio/workbench.css');
  const conversationDockStyles = readStyle('../../src/app/studio/conversation-dock.css');

  expect(studioStyles).toMatch(/\.badge--success\s*\{[\s\S]*?color:\s*var\(--success\)/u);
  expect(studioStyles).toMatch(/\.badge--warning\s*\{[\s\S]*?color:\s*var\(--warning\)/u);
  expect(studioStyles).toMatch(/\.badge--error\s*\{[\s\S]*?color:\s*var\(--error\)/u);
  expect(studioStyles).toMatch(/\.badge--primary\s*\{[\s\S]*?color:\s*var\(--primary\)/u);
  expect(studioStyles).toMatch(/\.inline-notice\s*>\s*\.ui-icon\s*\{[\s\S]*?color:\s*var\(--info\)/u);
  expect(conversationDockStyles).toMatch(/\.conversation-dock__status\s*>\s*span\.is-connected\s*\{[\s\S]*?background:\s*var\(--success\)/u);
  expect(libraryStyles).toMatch(/\.portfolio-steps li\.is-complete > span\s*\{[\s\S]*?background:\s*var\(--success\)/u);
  expect(libraryStyles).toMatch(/\.portfolio-analysis-section--texture[\s\S]*?var\(--accent-warm\)/u);
  expect(libraryStyles).toMatch(/\.portfolio-review__published\s*\{[\s\S]*?color:\s*var\(--success\)/u);
  expect(personaStyles).toMatch(/\.designer-profile-card__status--published[\s\S]*?var\(--success\)/u);
  expect(workbenchStyles).toMatch(/\.workbench-context-tools__finalize:not\(:disabled\)[\s\S]*?background:\s*var\(--success\)/u);
});

it('defines shared layout tokens for compact toolbar controls and unframed main content', () => {
  const tokens = readStyle('../../src/app/styles/tokens.css');

  expect(tokens).toMatch(/--toolbar-control-height:\s*28px/);
  expect(tokens).toMatch(/--toolbar-control-padding-inline:\s*8px/);
  expect(tokens).toMatch(/--content-card-background:\s*transparent/);
  expect(tokens).toMatch(/--content-card-shadow:\s*none/);
  expect(tokens).toMatch(/--scrollbar-size:\s*6px/);
  expect(tokens).toMatch(/--scrollbar-thumb:/);
  expect(tokens).toMatch(/--scrollbar-thumb-hover:/);
});

it('uses one responsive page-content spacing contract across regular pages', () => {
  const tokens = readStyle('../../src/app/styles/tokens.css');
  const studioStyles = readStyle('../../src/app/styles/studio.css');
  const personaStyles = readStyle('../../src/app/studio/persona.css');

  expect(tokens).toMatch(/--page-content-padding-block-start:\s*24px/);
  expect(tokens).toMatch(/--page-content-padding-inline:\s*28px/);
  expect(tokens).toMatch(/--page-content-padding-block-end:\s*20px/);
  expect(tokens).toMatch(
    /@media \(min-width:\s*1440px\)[\s\S]*?--page-content-padding-block-start:\s*28px[\s\S]*?--page-content-padding-inline:\s*32px[\s\S]*?--page-content-padding-block-end:\s*24px/,
  );
  expect(tokens).toMatch(
    /@media \(max-width:\s*1279px\)[\s\S]*?--page-content-padding-block-start:\s*20px[\s\S]*?--page-content-padding-inline:\s*24px[\s\S]*?--page-content-padding-block-end:\s*16px/,
  );
  expect(tokens).toMatch(
    /@media \(max-width:\s*560px\)[\s\S]*?--page-content-padding-block-start:\s*16px[\s\S]*?--page-content-padding-inline:\s*16px[\s\S]*?--page-content-padding-block-end:\s*16px/,
  );

  const pageContentRule = studioStyles.match(/\.page-content\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const designerLibraryRule = personaStyles.match(
    /\.page-content\.designer-library-page\s*\{([\s\S]*?)\n\}/u,
  )?.[1] ?? '';
  expect(pageContentRule).toMatch(
    /padding:\s*var\(--page-content-padding-block-start\)\s+var\(--page-content-padding-inline\)\s+var\(--page-content-padding-block-end\)/,
  );
  expect(designerLibraryRule).not.toMatch(/padding:/u);
  expect(personaStyles).not.toMatch(/\.designer-library-page\s*\{[^}]*padding:/u);
});

it('keeps resource cards at one shared fixed width without stretching the last row', () => {
  const tokens = readStyle('../../src/app/styles/tokens.css');
  const studioStyles = readStyle('../../src/app/styles/studio.css');
  const libraryStyles = readStyle('../../src/app/studio/library.css');
  const personaStyles = readStyle('../../src/app/studio/persona.css');
  const fixedColumns = /grid-template-columns:\s*repeat\(\s*auto-fill,\s*minmax\(min\(100%,\s*var\(--library-card-width\)\),\s*var\(--library-card-width\)\)\s*\)/;
  const largeWindowStyles = studioStyles.match(
    /@media \(min-width: 1440px\)\s*\{([\s\S]*?)\n\}\n@media \(max-width: 1279px\)/u,
  )?.[1] ?? '';

  expect(tokens).toMatch(/--library-card-width:\s*216px/);
  expect(studioStyles.match(/\.project-cover\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/height:\s*192px/);
  expect(largeWindowStyles).not.toMatch(/\.project-cover/);
  expect(studioStyles.match(/\.project-collection\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(fixedColumns);
  expect(studioStyles.match(/\.project-collection\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/justify-content:\s*start/);
  expect(libraryStyles.match(/\.asset-collection--grid\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(fixedColumns);
  expect(libraryStyles.match(/\.asset-collection--grid\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/justify-content:\s*start/);
  expect(personaStyles.match(/\.persona-repository__list\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(fixedColumns);
  expect(personaStyles.match(/\.persona-repository__list\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/justify-content:\s*start/);
  expect(studioStyles).toMatch(/\.project-collection--list\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  expect(libraryStyles).toMatch(/\.asset-collection--list\s*\{[\s\S]*display:\s*flex/);
});

it('reserves two lines for every project description and clamps overflow', () => {
  const styles = readStyle('../../src/app/styles/studio.css');
  const descriptionRule = styles.match(/\.project-card-description\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const cardRule = styles.match(/\.project-card\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const bodyRule = styles.match(/\.project-card-body\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const metadataRule = styles.match(/\.project-meta\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';

  expect(descriptionRule).toMatch(/display:\s*-webkit-box/);
  expect(descriptionRule).toMatch(/min-height:\s*32px/);
  expect(descriptionRule).toMatch(/line-height:\s*16px/);
  expect(descriptionRule).toMatch(/overflow:\s*hidden/);
  expect(descriptionRule).toMatch(/white-space:\s*normal/);
  expect(descriptionRule).toMatch(/-webkit-box-orient:\s*vertical/);
  expect(descriptionRule).toMatch(/-webkit-line-clamp:\s*2/);
  expect(cardRule).toMatch(/display:\s*grid/);
  expect(cardRule).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/);
  expect(bodyRule).toMatch(/display:\s*flex/);
  expect(bodyRule).toMatch(/flex-direction:\s*column/);
  expect(metadataRule).toMatch(/min-height:\s*24px/);
  expect(metadataRule).toMatch(/margin-top:\s*auto/);
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
    /\.library-split,[\s\S]*\.connection-layout,[\s\S]*\.delivery-layout\s*\{[\s\S]*border:\s*0;[\s\S]*border-radius:\s*0;[\s\S]*box-shadow:\s*var\(--content-card-shadow\)/,
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

it('uses compositor-friendly continuous portfolio loading motion', () => {
  const styles = readStyle('../../src/app/studio/library.css');
  const skeletonRule = styles.match(/\.portfolio-analysis-skeleton i,\s*\.portfolio-artwork-skeleton i\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const shimmerRule = styles.match(/\.portfolio-analysis-skeleton i::after,\s*\.portfolio-artwork-skeleton i::after\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const progressRule = styles.match(/\.portfolio-analysis-progress > span::after\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';

  expect(skeletonRule).toMatch(/position:\s*relative/);
  expect(skeletonRule).toMatch(/overflow:\s*hidden/);
  expect(shimmerRule).toMatch(/animation:\s*portfolio-skeleton\s+1\.8s\s+linear\s+infinite/);
  expect(shimmerRule).toMatch(/will-change:\s*transform/);
  expect(progressRule).toMatch(/animation:\s*portfolio-progress\s+1\.8s\s+linear\s+infinite/);
  expect(progressRule).not.toMatch(/alternate/);
  expect(styles).not.toMatch(/@keyframes portfolio-skeleton\s*\{[^}]*background-position/s);
  expect(styles).toMatch(/@keyframes portfolio-skeleton\s*\{[\s\S]*translate3d/);
  expect(reducedMotion).toMatch(/\.portfolio-analysis-skeleton i::after/);
  expect(reducedMotion).toMatch(/animation:\s*none/);
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

it('uses a seamless 30/70 conversation-first home without global divider lines', () => {
  const homeStyles = readStyle('../../src/app/studio/studio-home.css');
  const conversationDockStyles = readStyle('../../src/app/studio/conversation-dock.css');
  const workbenchStyles = readStyle('../../src/app/studio/workbench.css');
  const windowStyles = readStyle('../../src/app/styles/window.css');
  const studioStyles = readStyle('../../src/app/styles/studio.css');
  const projectPanelRule = homeStyles.match(/\.studio-home-projects\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';

  expect(homeStyles).toMatch(/\.studio-home\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*3fr\)\s+minmax\(0,\s*7fr\)/);
  expect(homeStyles).toMatch(/\.studio-home-projects__list\s*\{[\s\S]*overflow-y:\s*auto/);
  expect(homeStyles).toMatch(/\.home-designer-rail__list\s*\{[\s\S]*overflow-x:\s*auto/);
  expect(projectPanelRule).toMatch(/box-shadow:\s*inset/);
  expect(projectPanelRule).not.toMatch(/var\(--shadow-overlay\)/);
  expect(homeStyles).not.toMatch(/\.home-conversation__suggestions/);
  expect(homeStyles).not.toMatch(/\.home-conversation__composer/);
  expect(workbenchStyles).not.toMatch(/\.workbench-command-dock/);
  expect(conversationDockStyles).toMatch(/\.conversation-dock\s*\{[\s\S]*background:[\s\S]*var\(--shell-glass\)/);
  expect(conversationDockStyles).toMatch(/\.conversation-dock\s*\{[\s\S]*box-shadow:\s*inset/);
  expect(conversationDockStyles).not.toMatch(/box-shadow:[^;]*0\s+14px\s+34px/);
  expect(windowStyles.match(/\.window-bar\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/border-bottom:\s*0/);
  expect(windowStyles).toMatch(/\.app-shell::before\s*\{[\s\S]*radial-gradient\(circle,[\s\S]*var\(--workspace-dot-base\)/);
  expect(windowStyles).toMatch(/\.app-shell::after\s*\{[\s\S]*circle 150px at var\(--pointer-x\) var\(--pointer-y\)/);
  expect(windowStyles).toMatch(/\.app-shell\[data-pointer-active='true'\]::after\s*\{\s*opacity:\s*1/);
  expect(windowStyles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.app-shell::after\s*\{\s*display:\s*none/);
  expect(windowStyles).not.toMatch(/linear-gradient\(118deg/);
  expect(homeStyles.match(/\.studio-home\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').not.toMatch(/background:/);
  expect(studioStyles).not.toMatch(/\.studio-sidebar\s*\{/);
  expect(studioStyles).not.toMatch(/\.studio-status\s*\{/);
});

it('keeps the dot workspace visible through glass controls', () => {
  const tokens = readStyle('../../src/app/styles/tokens.css');
  const homeStyles = readStyle('../../src/app/studio/studio-home.css');
  const dockStyles = readStyle('../../src/app/studio/conversation-dock.css');

  expect(tokens).toMatch(/rgb\(255 255 255 \/ 0\.(?:[0-4]\d)\)/u);
  expect(tokens).toMatch(/--shell-glass:\s*color-mix\(/u);
  expect(homeStyles).toMatch(/\.studio-home-projects__filters\s*\{[\s\S]*background:\s*color-mix\([^;]*transparent/u);
  expect(homeStyles.match(/\.studio-home-projects__filters button\.is-active\s*\{([^}]*)\}/u)?.[1] ?? '').not.toMatch(/var\(--surface-container-highest\)/u);
  expect(homeStyles.match(/\.home-designer-card\s*\{([^}]*)\}/u)?.[1] ?? '').not.toMatch(/var\(--surface-container\)/u);
  expect(dockStyles.match(/\.conversation-dock__connection\s*\{([^}]*)\}/u)?.[1] ?? '').not.toMatch(/var\(--surface-container-high\)\s+68%/u);
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

it('keeps model task columns aligned, the header fixed, and the result centered', () => {
  const libraryStyles = readStyle('../../src/app/studio/library.css');
  const taskListRule = libraryStyles.match(/\.task-list\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const taskRowRule = libraryStyles.match(/\.task-row\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const taskHeaderRule = libraryStyles.match(/\.task-row--header\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const taskResultRule = libraryStyles.match(/\.task-row__result\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';

  expect(taskListRule).toMatch(/flex:\s*1 1 auto;/u);
  expect(taskListRule).toMatch(/min-height:\s*0;/u);
  expect(taskListRule).toMatch(/overflow:\s*auto;/u);
  expect(taskRowRule).toMatch(/grid-template-columns:[\s\S]*minmax\(112px,\s*0\.8fr\)\s+104px/u);
  expect(taskHeaderRule).toMatch(/position:\s*sticky;/u);
  expect(taskHeaderRule).toMatch(/top:\s*0;/u);
  expect(taskHeaderRule).toMatch(/z-index:\s*2;/u);
  expect(taskResultRule).toMatch(/text-align:\s*center;/u);
});

it('fills the model connection status and keeps the capability matrix below it', () => {
  const libraryStyles = readStyle('../../src/app/studio/library.css');

  expect(libraryStyles).toMatch(
    /\.connection-layout\s*\{[\s\S]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/,
  );
  expect(libraryStyles).toMatch(
    /\.connection-layout--status-first\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto;/,
  );
  expect(libraryStyles).toMatch(
    /\.library-page\s*>\s*\.connection-layout\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/,
  );
  expect(libraryStyles).toMatch(
    /\.connection-layout\s*>\s*\.page-empty-state\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*1;[\s\S]*align-self:\s*stretch;[\s\S]*border-bottom:\s*1px\s+solid\s+var\(--border-subtle\);/,
  );
  expect(libraryStyles).toMatch(
    /\.connection-layout\s*>\s*\.capability-matrix\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*2;/,
  );
  expect(libraryStyles).toMatch(
    /\.connection-layout\s*>\s*\.capability-matrix\s*\{[\s\S]*padding:\s*24px\s+40px\s+28px;[\s\S]*border-right:\s*0;/,
  );
  expect(libraryStyles).toMatch(
    /\.matrix-heading,\s*\.matrix-row\s*\{[\s\S]*margin-inline:\s*0;/,
  );
});

it('hides the backing select input text so the custom label is rendered once', () => {
  const styles = readStyle('../../src/app/styles/studio.css');

  expect(styles).toMatch(
    /\.ui-select__trigger\s*\{[\s\S]*color:\s*transparent\s*!important;[\s\S]*-webkit-text-fill-color:\s*transparent\s*!important;[\s\S]*text-indent:\s*-9999px;/,
  );
});

it('ships the icons used by provider and project actions', () => {
  expect(existsSync('public/icons/save.svg')).toBe(true);
  expect(existsSync('public/icons/pencil.svg')).toBe(true);
});

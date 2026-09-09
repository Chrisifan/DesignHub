import { defineConfig } from 'playwright/test';

export default defineConfig({ testDir: './tests/native', testMatch: '**/*.spec.ts', reporter: 'list' });

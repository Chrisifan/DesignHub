import { VitePlugin } from '@electron-forge/plugin-vite';

const config = {
  packagerConfig: { asar: true },
  rebuildConfig: {},
  makers: [],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/desktop/main.ts', config: 'vite.main.config.ts' },
        { entry: 'src/desktop/preload.ts', config: 'vite.preload.config.ts' }
      ],
      renderer: [{ name: 'main_window', config: 'vite.config.ts' }]
    })
  ]
};

export default config;

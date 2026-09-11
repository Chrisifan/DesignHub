import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';

const retainViteOutputAndNativeStorage = (file: string): boolean => Boolean(file)
  && file !== '/package.json'
  && !file.startsWith('/.vite')
  && file !== '/node_modules'
  && file !== '/node_modules/better-sqlite3'
  && !file.startsWith('/node_modules/better-sqlite3/');

const config = {
  packagerConfig: { asar: true, ignore: retainViteOutputAndNativeStorage },
  rebuildConfig: {},
  makers: [],
  plugins: [
    new AutoUnpackNativesPlugin({}),
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

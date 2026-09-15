import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import MakerDMG from '@electron-forge/maker-dmg';
import MakerSquirrel from '@electron-forge/maker-squirrel';
import MakerZIP from '@electron-forge/maker-zip';

const retainViteOutputAndNativeStorage = (file: string): boolean => Boolean(file)
  && file !== '/package.json'
  && !file.startsWith('/.vite')
  && file !== '/node_modules'
  && file !== '/node_modules/better-sqlite3'
  && !file.startsWith('/node_modules/better-sqlite3/')
  && file !== '/node_modules/@napi-rs'
  && file !== '/node_modules/@napi-rs/keyring'
  && !file.startsWith('/node_modules/@napi-rs/keyring/')
  && !file.startsWith('/node_modules/@napi-rs/keyring-');

const config = {
  packagerConfig: { asar: true, ignore: retainViteOutputAndNativeStorage },
  rebuildConfig: {},
  makers: [
    new MakerDMG({ name: 'DesignHub' }),
    new MakerSquirrel({ name: 'designhub' }),
    new MakerZIP({}),
  ],
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

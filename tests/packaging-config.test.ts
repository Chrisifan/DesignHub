import forgeConfig from '../forge.config';

describe('Windows native image runtime packaging', () => {
  it('unpacks sharp platform libraries beside native sharp binaries', () => {
    expect(forgeConfig.packagerConfig.asar).toMatchObject({
      unpackDir: 'node_modules/@img/sharp-*/lib'
    });
  });
});

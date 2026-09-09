import { expect, it } from 'vitest';

import config from '../../forge.config';

it('registers the Forge plugin that unpacks native Node modules from ASAR', () => {
  expect(config.plugins.map((plugin) => plugin.name)).toContain('auto-unpack-natives');
});

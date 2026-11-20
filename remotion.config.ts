// Präsentationen liegen außerhalb dieses Ordners (eingehängt unter inhalte/). Damit ihre Folien beim Rendern
// die hier installierten Pakete finden, wird dieser node_modules-Ordner ausdrücklich in die Suche aufgenommen.
import path from 'node:path';
import {Config} from '@remotion/cli/config';

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    modules: [path.resolve(process.cwd(), 'node_modules'), 'node_modules'],
  },
}));

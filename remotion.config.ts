// Presentations live outside this folder (linked under inhalte/). So that their slides find the packages
// installed here when rendering, this node_modules folder is added to the module search explicitly.
import path from 'node:path';
import {Config} from '@remotion/cli/config';

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    modules: [path.resolve(process.cwd(), 'node_modules'), 'node_modules'],
  },
}));

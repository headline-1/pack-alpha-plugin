import { CommandBuilder, ParametersBuilder, Types } from '@lpha/core';
import { createWebpackConfiguration } from './config/webpack.config';
import { build } from './scripts/build';
import { startBrowser } from './scripts/startBrowser';
import { arraify } from './utils/array.util';
import { startWatch } from './scripts/startWatch';

module.exports = new CommandBuilder()
  .name('pack')
  .description('Pack your project with Webpack')
  .parameters(
    new ParametersBuilder()
      .add('type', {
        type: Types.keyof({
          browser: null,
          browserLibrary: null,
        }),
        description: 'Your package type',
        required: true,
        cli: 'type',
      })
      .add('mode', {
        type: Types.keyof({
          development: null,
          production: null,
        }),
        description: 'Use development for watch mode (and local server in case of browser)',
        required: true,
        default: 'production',
        cli: 'mode',
      })
      .add('entry', {
        type: Types.union([Types.string, Types.array(Types.string)]),
        description: 'Entry file(s) that should be packed',
        required: true,
        cli: 'entry',
      })
      .add('output', {
        type: Types.string,
        description: 'Build output directory',
        default: 'dist',
        cli: 'output',
        required: true,
      })
      .add('sources', {
        type: Types.union([Types.string, Types.array(Types.string)]),
        description: 'Source directory of the app',
        default: 'src',
        cli: 'sources',
        required: true,
      })
      .add('html', {
        type: Types.union([Types.string, Types.boolean]),
        description: 'HTML template for browser app (set it to true if you still want to emit the default index file)',
        cli: 'html',
        required: false,
      })
      .add('staticPath', {
        type: Types.string,
        description: 'Static files directory, which contents will be copied to the ourput location',
        cli: 'staticPath',
        required: false,
      })
      .add('circularDependencies', {
        type: Types.keyof({
          error: null,
          warn: null,
          disable: null,
        }),
        description: 'Determines if we should check for circularDependencies or not',
        cli: 'circularDependencies',
        required: false,
      })
      .build(),
  )
  .execute(async ({
    entry, mode, type, sources, output, html, staticPath, circularDependencies,
  }) => {
    const config = await createWebpackConfiguration({
      type,
      entry,
      mode,
      sources: arraify(sources, ','),
      outputPath: output,
      root: process.cwd(),
      html,
      staticPath,
      circularDependencies,
      env: process.env as Record<string, string>,
    });

    switch (mode) {
      case 'development':
        switch (type) {
          case 'browserLibrary':
            await startWatch(config);
            break;
          case 'browser':
            await startBrowser(config);
            break;
        }
        break;
      case 'production':
        await build(config);
        break;
    }
  })
  .build();

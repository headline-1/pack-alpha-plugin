import { ConfigResult } from '../config/config.types';
import {
  measureFileSizesBeforeBuild,
  OpaqueFileSizes,
  printFileSizesAfterBuild
} from 'react-dev-utils/FileSizeReporter';
import webpack, { ProgressPlugin, Stats } from 'webpack';
import printBuildError from 'react-dev-utils/printBuildError';
import printHostingInstructions from 'react-dev-utils/printHostingInstructions';
import formatWebpackMessages from 'react-dev-utils/formatWebpackMessages';
import checkRequiredFiles from 'react-dev-utils/checkRequiredFiles';
import bfj from 'bfj';
import fs from 'fs-extra';
import chalk from 'chalk';
import path from 'path';
import { Logger } from '@lpha/core';
import { last } from 'lodash';
import { WriteStream } from 'tty';

const TAG = 'Webpack';

process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

export const buildForProduction = async ({ webpackConfig, options, config }: ConfigResult) => {
  const copyPublicFolder = () => {
    if (!options.staticPath) {
      return;
    }
    fs.copySync(options.staticPath, config.paths.output, {
      dereference: true,
    });
  };

  const checkFilesPresence = (files: string[]) => {
    // Warn and crash if required files are missing
    if (!checkRequiredFiles(files)) {
      process.exit(1);
    }
  };

  const build = async (previousFileSizes: OpaqueFileSizes) => {
    Logger.log(TAG, 'Creating an optimized production build...');

    let compiler = webpack(webpackConfig);
    const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
    const tty = process.stdout.isTTY && process.stdout as WriteStream;
    new ProgressPlugin((percentage, message, moduleProgress = '', _, moduleName) => {
      const progress = `${(percentage * 100).toFixed(1)}%`;
      const status = `${chalk.bold(capitalize(message))}: ${progress}`;
      const modules = !moduleName ? [] : moduleName.split('!')
        .map(p => p.split('?')[0])
        .map(p => path.relative(options.root, p));
      const module = last(modules);
      let moduleInfo = '';
      if (module) {
        moduleInfo += ` | ${chalk.underline(module)}`;

        const loaders = modules.slice(0, modules.length - 1)
          .map(l => last(l.split('node_modules/'))!.split('/')[0]);
        if (loaders.length) {
          moduleInfo += chalk.grey(` with: ${loaders.join(', ')}`);
        }
      }
      if (tty) {
        tty.cursorTo(0, 0);
        tty.clearScreenDown();
      }
      Logger.log(TAG, status + moduleInfo);
    }).apply(compiler);
    return new Promise<{
      stats: Stats;
      previousFileSizes: OpaqueFileSizes;
      warnings: string[];
    }>((resolve, reject) => {
      compiler.run(async (err: Error, stats: Stats): Promise<void> => {
        if (err) {
          return reject(err);
        }
        const jsonStats = stats.toJson({ all: false, warnings: true, errors: true });
        const messages = formatWebpackMessages(jsonStats);
        if (messages.errors.length) {
          // Only keep the first error. Others are often indicative
          // of the same problem, but confuse the reader with noise.
          if (messages.errors.length > 1) {
            messages.errors.length = 1;
          }
          return reject(new Error(messages.errors.join('\n\n')));
        }
        if (
          process.env.CI &&
          (typeof process.env.CI !== 'string' ||
            process.env.CI.toLowerCase() !== 'false') &&
          messages.warnings.length
        ) {
          Logger.log(TAG,
            chalk.yellow(
              '\nTreating warnings as errors because process.env.CI = true.\n' +
              'Most CI servers set it automatically.\n'
            )
          );
          return reject(new Error(messages.warnings.join('\n\n')));
        }

        if (options.stats) {
          await bfj.write(path.join(config.paths.output, 'bundle-stats.json'), stats.toJson());
        }

        return resolve({
          stats,
          previousFileSizes,
          warnings: messages.warnings,
        });
      });
    });
  };

  try {
    checkFilesPresence(config.paths.entries);
    const cwd = process.cwd();
    const fileSizes = await measureFileSizesBeforeBuild(config.paths.output);
    fs.emptyDirSync(config.paths.output);
    copyPublicFolder();
    try {
      const { stats, previousFileSizes, warnings } = await build(fileSizes);
      if (warnings.length) {
        Logger.warn(TAG, chalk.yellow('Compiled with warnings.\n'));
        Logger.warn(TAG, warnings.join('\n\n'));
      } else {
        Logger.log(TAG, chalk.green('Compiled successfully.\n'));
      }

      Logger.log(TAG, 'File sizes after gzip:\n');
      printFileSizesAfterBuild(
        stats,
        previousFileSizes,
        config.paths.output,
        WARN_AFTER_BUNDLE_GZIP_SIZE,
        WARN_AFTER_CHUNK_GZIP_SIZE
      );
      console.log();

      const appPackage = require(path.join(cwd, './package.json'));
      const publicPath = webpackConfig.output!.publicPath!;
      const publicUrl = (publicPath + '/').replace(/\/{2,}/g, '/');
      const buildFolder = path.relative(cwd, webpackConfig.output!.path!);
      const useYarn = fs.existsSync(path.resolve(cwd, 'yarn.lock'));

      if (options.type === 'browser') {
        printHostingInstructions(
          appPackage,
          publicUrl,
          publicPath,
          buildFolder,
          useYarn
        );
      }
    } catch (err) {
      Logger.error(TAG, 'Failed to compile.\n');
      printBuildError(err);
      process.exit(1);
    }
  } catch (err) {
    if (err && err.message) {
      Logger.error(TAG, err.message);
    }
    process.exit(1);
  }
};

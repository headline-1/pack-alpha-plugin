import { ConfigResult } from '../config/config.types';
import { measureFileSizesBeforeBuild, printFileSizesAfterBuild, OpaqueFileSizes } from 'react-dev-utils/FileSizeReporter';
import webpack, { Stats } from 'webpack';
import printBuildError from 'react-dev-utils/printBuildError';
import printHostingInstructions from 'react-dev-utils/printHostingInstructions';
import formatWebpackMessages from 'react-dev-utils/formatWebpackMessages';
import checkRequiredFiles from 'react-dev-utils/checkRequiredFiles';
import bfj from 'bfj';
import fs from 'fs-extra';
import chalk from 'chalk';
import path from 'path';

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

export const build = async ({ webpackConfig, options, config }: ConfigResult) => {
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
    console.log('Creating an optimized production build...');

    let compiler = webpack(webpackConfig);
    return new Promise<{
      stats: Stats;
      previousFileSizes: OpaqueFileSizes;
      warnings: string[];
    }>((resolve, reject) => {
      compiler.run(async (err: Error, stats: Stats): Promise<void> => {
        if (err) {
          return reject(err);
        }
        const messages = formatWebpackMessages(
          stats.toJson({ all: false, warnings: true, errors: true })
        );
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
          console.log(
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
        console.log(chalk.yellow('Compiled with warnings.\n'));
        console.log(warnings.join('\n\n'));
        console.log(
          '\nSearch for the ' +
          chalk.underline(chalk.yellow('keywords')) +
          ' to learn more about each warning.'
        );
        console.log(
          'To ignore, add ' +
          chalk.cyan('// eslint-disable-next-line') +
          ' to the line before.\n'
        );
      } else {
        console.log(chalk.green('Compiled successfully.\n'));
      }

      console.log('File sizes after gzip:\n');
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

      printHostingInstructions(
        appPackage,
        publicUrl,
        publicPath,
        buildFolder,
        useYarn
      );
    } catch (err) {
      console.log(chalk.red('Failed to compile.\n'));
      printBuildError(err);
      process.exit(1);
    }
  } catch (err) {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  }
};

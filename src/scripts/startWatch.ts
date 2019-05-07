import * as path from 'path';
import chalk from 'chalk';
import webpack from 'webpack';
import clearConsole from 'react-dev-utils/clearConsole';
import checkRequiredFiles from 'react-dev-utils/checkRequiredFiles';
import { ConfigResult } from '../config/config.types';
import formatWebpackMessages from 'react-dev-utils/formatWebpackMessages';
import bfj from 'bfj';

process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

const isInteractive = process.stdout.isTTY;

const checkFilesPresence = (files: string[]) => {
  // Warn and crash if required files are missing
  if (!checkRequiredFiles(files)) {
    process.exit(1);
  }
};

export const startWatch = async (configResult: ConfigResult) => {
  const { options, config, webpackConfig } = configResult;
  checkFilesPresence(config.paths.entries);
  try {
    const compiler = webpack(webpackConfig);
    const watcher = compiler.watch({
      ignored: config.ignore,
    }, async (err, stats) => {
      if (err) {
        return console.log(chalk.red(`${chalk.bold(err.name)}: ${err.message}`));
      }
      if (isInteractive) {
        clearConsole();
      }
      const { warnings, errors } = formatWebpackMessages(
        stats.toJson({ all: false, warnings: true, errors: true })
      );
      if (errors.length) {
        console.log(chalk.red('Compilation failed.\n'));
        console.log(errors.join('\n\n'));
      }
      if (warnings.length) {
        console.log(chalk.yellow('Warnings occurred.\n'));
        console.log(warnings.join('\n\n'));
      }
      if(errors.length || warnings.length){
        return;
      }
      console.log(chalk.green('Compiled successfully.\n'));

      if (options.stats) {
        await bfj.write(path.join(config.paths.output, 'bundle-stats.json'), stats.toJson());
      }
    });

    const die = () => {
      watcher.close(() => {
        process.exit();
      });
    };
    process.on('SIGINT', die);
    process.on('SIGTERM', die);
  } catch (err) {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  }
};

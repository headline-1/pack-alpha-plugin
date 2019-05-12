import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import clearConsole from 'react-dev-utils/clearConsole';
import checkRequiredFiles from 'react-dev-utils/checkRequiredFiles';
import { choosePort, createCompiler, prepareProxy, prepareUrls } from 'react-dev-utils/WebpackDevServerUtils';

import openBrowser from 'react-dev-utils/openBrowser';
import { ConfigResult } from '../config/config.types';
import { createWebpackDevServerConfiguration } from '../config/devServer.config';
import { getPackageJson } from '../utils/packageJson.util';

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

const DEFAULT_PORT = (process.env.PORT ? parseInt(process.env.PORT, 10) : 0) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

export const startBrowser = async (configResult: ConfigResult) => {
  const { options, config, webpackConfig } = configResult;
  checkFilesPresence(config.paths.entries);
  try {
    if (process.env.HOST) {
      console.log(
        chalk.cyan(
          `Attempting to bind to HOST environment variable: ${chalk.yellow(
            chalk.bold(process.env.HOST)
          )}`
        )
      );
    }

    const cwd = process.cwd();
    const useYarn = fs.existsSync(path.resolve(cwd, 'yarn.lock'));
    const port = await choosePort(HOST, DEFAULT_PORT);
    if (!port) {
      return;
    }
    const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
    const packageJson = await getPackageJson();
    const {
      name: appName,
      proxy: proxySetting,
    } = packageJson;
    const urls = prepareUrls(protocol, HOST, port);
    const compiler = createCompiler({ webpack, config: webpackConfig, appName, urls, useYarn });
    const proxyConfig = options.staticPath
      ? prepareProxy(proxySetting, path.resolve(cwd, options.staticPath))
      : undefined;
    const serverConfig = createWebpackDevServerConfiguration(
      configResult,
      proxyConfig,
      urls.lanUrlForConfig,
    );
    await new Promise((resolve) => {
      const devServer = new WebpackDevServer(compiler, serverConfig);
      devServer.listen(port, HOST, (err?: Error) => {
        if (err) {
          return console.log(err);
        }
        if (isInteractive) {
          clearConsole();
        }
        console.log(chalk.cyan('Starting the development server...\n'));
        openBrowser(urls.localUrlForBrowser);
      });

      const die = () => {
        devServer.close();
        resolve();
      };
      process.on('SIGINT', die);
      process.on('SIGTERM', die);
    });
  } catch (err) {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  }
};

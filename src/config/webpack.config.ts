import * as fs from 'fs';
import * as path from 'path';
import { defaults } from 'lodash';
import * as webpack from 'webpack';
import { Configuration } from 'webpack';
import merge from 'webpack-merge';
import WatchMissingNodeModulesPlugin from 'react-dev-utils/WatchMissingNodeModulesPlugin';
import TerserPlugin from 'terser-webpack-plugin';
import CaseSensitivePathsPlugin from 'case-sensitive-paths-webpack-plugin';
import ManifestPlugin from 'webpack-manifest-plugin';
import ModuleScopePlugin from 'react-dev-utils/ModuleScopePlugin';
import CircularDependencyPlugin from 'circular-dependency-plugin';
import { Config, ConfigOptions, ConfigResult } from './config.types';
import { accessFile } from '../utils/access.util';
import { arraify } from '../utils/array.util';
import { isTruthy, removeNonTruthyValues } from '../utils/notNil.util';
import { fromEntries } from '../utils/fromEntries.util';
import { getPacks } from '../packs';

const getNodePath = () => {
  const appDirectory = fs.realpathSync(process.cwd());
  return (process.env.NODE_PATH || '')
    .split(path.delimiter)
    .filter(folder => folder && !path.isAbsolute(folder))
    .map(folder => path.resolve(appDirectory, folder))
    .join(path.delimiter);
};

export const createWebpackConfiguration = async (options: ConfigOptions): Promise<ConfigResult> => {
  const {
    type,
    root,
    entry,
    mode,
    outputPath,
    outputFilename,
    outputChunkFilename,
    outputAssetFilename,
    publicPath,
    tslintPath,
    aliases,
    sources,
    circularDependencies,
    env,
    ignore,
  } = options = defaults(options, {
    entry: 'src/index.js',
    mode: 'production' as string,
    outputPath: 'dist',
    outputAssetFilename: 'static/media/[name].[hash:8].[ext]',
    outputCssFilename: 'static/css/[name].[contenthash:8].css',
    outputCssChunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
    publicPath: '/',
    aliases: {},
    sources: [],
    ignore: [],
    lint: true,
    sourceMaps: true,
    circularDependencies: 'warn' as string,
  });
  const dev = mode === 'development';
  process.env.NODE_PATH = getNodePath();
  process.env.NODE_ENV = mode;
  process.env.PUBLIC_URL = publicPath.replace(/\/+$/g, '');

  const environment = { ...process.env, ...env } as Record<string, string>;
  const stringifiedEnvironment = {
    'process.env': Object.entries(environment).reduce((env, [key, value]) => {
      env[key] = JSON.stringify(value);
      return env;
    }, {}),
  };

  const config: Config = {
    options,
    environment,
    ignore: arraify(ignore),
    paths: {
      entries: arraify(entry, ',').map(e => path.join(root, e)),
      output: path.join(root, outputPath),
      sources: sources.map(s => path.join(root, s)),
      tslint: tslintPath ? path.join(root, tslintPath) : await accessFile('tslint.json'),
      packageJson: await accessFile('package.json'),
    }
  };
  const packageJson = config.paths.packageJson ? await import(config.paths.packageJson) : {};

  const developmentConfig: Configuration = {
    mode: 'development',
    devtool: 'cheap-module-source-map',
    entry: removeNonTruthyValues({
      whd: type === 'browser' && require.resolve('react-dev-utils/webpackHotDevClient'),
    }),
    output: {
      pathinfo: true,
      filename: type === 'browser' ? 'static/js/[name].js' : '[name].js',
      chunkFilename: type === 'browser' ? 'static/js/[name].chunk.js' : undefined,
      devtoolModuleFilenameTemplate: (info: any) => path
        .resolve(info.absoluteResourcePath)
        .replace(/\\/g, '/'),
    },
  };
  const productionConfig: Configuration = {
    mode: 'production',
    bail: true,
    devtool: 'source-map',
    output: {
      filename: type === 'browser' ? 'static/js/[name].[chunkhash:8].js' : '[name].js',
      chunkFilename: type === 'browser' ? 'static/js/[name].[chunkhash:8].chunk.js' : undefined,
      devtoolModuleFilenameTemplate: (info: any) => path
        .relative(root, info.absoluteResourcePath)
        .replace(/\\/g, '/'),
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            parse: { ecma: 8 },
            compress: { ecma: 5, warnings: false, comparisons: false } as any,
            mangle: { safari10: true },
            output: { ecma: 5, comments: false, ascii_only: true },
          },
          parallel: true,
          cache: true,
          sourceMap: true,
        }),

      ],
    },
  };

  const threadLoader = {
    loader: require.resolve('thread-loader'),
    options: dev ? { poolTimeout: Infinity } : undefined,
  };

  const hasEslintConfig = async () =>
    !!(await accessFile(/^\.eslintrc\.(js|ya?ml|json)/)) ||
    !!(await import(path.join(root, 'package.json'))).eslintConfig;

  const entries = fromEntries(config.paths.entries
    .map(entry => ([path.basename(entry, path.extname(entry)), entry])));

  const mainConfig: Configuration = {
    entry: removeNonTruthyValues({
      // TODO use Object.fromEntries when ES2019 is available in TS
      ...entries,
    }),
    output: {
      path: config.paths.output,
      publicPath,
      filename: outputFilename,
      chunkFilename: outputChunkFilename,
      library: type !== 'browser' ? '' : undefined,
      libraryTarget: type !== 'browser' ? 'commonjs' : undefined,
    },
    optimization: {
      runtimeChunk: type === 'browser',
      splitChunks: type === 'browser' ? {
        chunks: 'all',
        name: false,
      } : false,
    },
    resolve: {
      plugins: [
        new ModuleScopePlugin(config.paths.sources, [path.join(root, 'package.json')]),
      ].filter(isTruthy),
      symlinks: false,
      modules: ['node_modules']
        .concat(path.resolve(path.join(__dirname, 'node_modules')))
        .concat(process.env.NODE_PATH.split(path.delimiter).filter(isTruthy)),
      extensions: ['.web.ts', '.ts', '.web.tsx', '.tsx', '.web.js', '.js', '.json', '.web.jsx', '.jsx'],
      alias: {
        'react-native': 'react-native-web',
        ...aliases,
      },
    },
    module: {
      strictExportPresence: true,
      rules: [
        { parser: { requireEnsure: false } },
        (await hasEslintConfig()) && {
          test: /\.(js|ts)x?$/,
          enforce: 'pre' as 'pre',
          use: [
            {
              options: {
                formatter: require.resolve('react-dev-utils/eslintFormatter'),
                eslintPath: require('eslint'),
              },
              loader: require.resolve('eslint-loader'),
            },
          ],
          include: config.paths.sources[0], // Test the primary source directory
        },
        {
          test: /\.(js|jsx|mjs)$/,
          loader: require.resolve('source-map-loader'),
          enforce: 'pre' as 'pre',
          include: config.paths.sources[0],
        },
        {
          test: /\.mjs$/,
          include: /node_modules/,
          type: 'javascript/auto' as 'javascript/auto',
        },
        {
          oneOf: [
            // Images
            {
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
              loader: require.resolve('url-loader'),
              options: {
                limit: 10000,
                name: outputAssetFilename,
              },
            },
            // Source JS
            {
              test: /\.(jsx?)$/,
              include: config.paths.sources,
              use: [
                threadLoader,
                {
                  loader: require.resolve('babel-loader'),
                  options: {
                    customize: require.resolve('babel-preset-react-app/webpack-overrides'),
                    plugins: [
                      [
                        require.resolve('babel-plugin-named-asset-import'),
                        {
                          loaderMap: {
                            svg: { ReactComponent: '@svgr/webpack?-prettier,-svgo![path]' },
                          },
                        },
                      ],
                    ],
                    cacheDirectory: true,
                    cacheCompression: false,
                    compact: !dev,
                  },
                },
              ],
            },
            // External JS
            {
              test: /\.js$/,
              exclude: /@babel(?:\/|\\{1,2})runtime/,
              use: [
                threadLoader,
                {
                  loader: require.resolve('babel-loader'),
                  options: {
                    babelrc: false,
                    configFile: false,
                    compact: false,
                    presets: [
                      [
                        require.resolve('babel-preset-react-app/dependencies'),
                        { helpers: true },
                      ],
                    ],
                    cacheDirectory: true,
                    cacheCompression: false,
                    sourceMaps: false,
                  },
                },
              ],
            },
            {
              loader: require.resolve('file-loader'),
              exclude: [/\.(tsx?|jsx?|json|html)$/],
              options: {
                name: outputAssetFilename,
              },
            },
          ].filter(isTruthy),
        },
      ].filter(isTruthy),
    },
    plugins: [
      circularDependencies && circularDependencies !== 'disable' && new CircularDependencyPlugin({
        exclude: /node_modules/,
        failOnError: circularDependencies === 'error',
        allowAsyncCycles: false,
        cwd: process.cwd(),
      }),
      new webpack.DefinePlugin(stringifiedEnvironment),
      dev && new webpack.HotModuleReplacementPlugin(),
      dev && new CaseSensitivePathsPlugin(),
      dev && new WatchMissingNodeModulesPlugin(path.resolve(root, 'node_modules')),
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
      new ManifestPlugin({
        fileName: 'asset-manifest.json',
        publicPath,
      }),
    ].filter(isTruthy),
    node: {
      dgram: 'empty',
      fs: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty',
    },
    performance: false,
    externals: type !== 'browser' ? Object.keys(packageJson.peerDependencies || {}) : undefined,
  };

  const packs = await getPacks(config);

  const webpackConfig = merge.smart(
    dev ? developmentConfig : productionConfig,
    mainConfig,
    ...packs,
  );

  return {
    options,
    config,
    webpackConfig,
  };
};

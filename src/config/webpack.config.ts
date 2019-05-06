import * as fs from 'fs';
import * as path from 'path';
import { defaults, merge } from 'lodash';
import * as webpack from 'webpack';
import { Configuration } from 'webpack';
import WatchMissingNodeModulesPlugin from 'react-dev-utils/WatchMissingNodeModulesPlugin';
import TerserPlugin from 'terser-webpack-plugin';
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin';
import CaseSensitivePathsPlugin from 'case-sensitive-paths-webpack-plugin';
import safePostCssParser from 'postcss-safe-parser';
import ManifestPlugin from 'webpack-manifest-plugin';
import ModuleScopePlugin from 'react-dev-utils/ModuleScopePlugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import CircularDependencyPlugin from 'circular-dependency-plugin';
import { getStylePack } from '../packs/style.pack';
import { getHtmlPack } from '../packs/html.pack';
import { getWorkboxPack } from '../packs/workbox.pack';
import { Config, ConfigOptions, ConfigResult } from './config.types';
import { accessFile } from '../utils/access.util';
import { arraify } from '../utils/array.util';

const getNodePath = () => {
  const appDirectory = fs.realpathSync(process.cwd());
  return (process.env.NODE_PATH || '')
    .split(path.delimiter)
    .filter(folder => folder && !path.isAbsolute(folder))
    .map(folder => path.resolve(appDirectory, folder))
    .join(path.delimiter);
};

const aliasTsconfigPaths = (tsconfig: any) => Object
  .entries((tsconfig.compilerOptions.paths || {}) as Record<string, string[]>)
  .reduce((aliases, [key, [value]]) => {
    const slashIndex = key.indexOf('/');
    const exactMatch = key.indexOf('*') < 0 ? '$' : '';
    aliases[(slashIndex < 0 ? key : key.slice(0, slashIndex)) + exactMatch] = path.resolve(value);
    return aliases;
  }, {} as Record<string, string>);

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
    tsconfigPath,
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
    aliases: [],
    sources: [],
    ignore: [],
    lint: true,
    sourceMaps: true,
    circularDependencies: 'warn' as string,
  });
  const dev = mode === 'development';
  process.env.NODE_PATH = getNodePath();
  process.env.NODE_ENV = mode;
  process.env.PUBLIC_URL = (publicPath + '/').replace(/\/{2,}/g, '/');

  const environment = { ...process.env, ...env } as Record<string, string>;
  const stringifiedEnvironment = {
    'process.env': Object.entries(environment).reduce((env, [key, value]) => {
      env[key] = JSON.stringify(value);
      return env;
    }, {}),
  };

  const config: Config = {
    environment,
    ignore: arraify(ignore),
    paths: {
      entries: arraify(entry, ',').map(e => path.join(root, e)),
      output: path.join(root, outputPath),
      sources: sources.map(s => path.join(root, s)),
      tsconfig: tsconfigPath ? path.join(root, tsconfigPath) : await accessFile('tsconfig.json'),
      tslint: tslintPath ? path.join(root, tslintPath) : await accessFile('tslint.json'),
    }
  };

  const developmentConfig: Configuration = {
    mode: 'development',
    devtool: 'cheap-module-source-map',
    entry: [
      require.resolve('react-dev-utils/webpackHotDevClient'),
    ],
    output: {
      pathinfo: true,
      filename: 'static/js/bundle.js',
      chunkFilename: 'static/js/[name].chunk.js',
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
      filename: 'static/js/[name].[chunkhash:8].js',
      chunkFilename: 'static/js/[name].[chunkhash:8].chunk.js',
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
        new OptimizeCSSAssetsPlugin({
          cssProcessorOptions: {
            parser: safePostCssParser,
            map: { inline: false, annotation: true },
          },
        }),
      ],
    },
  };

  const tsconfigAliases = config.paths.tsconfig
    ? aliasTsconfigPaths(require(config.paths.tsconfig))
    : [];

  const threadLoader = {
    loader: require.resolve('thread-loader'),
    options: dev ? { poolTimeout: Infinity } : undefined,
  };

  const hasEslintConfig = async () =>
    !!(await accessFile(/^\.eslintrc\.(js|ya?ml|json)/)) ||
    !!(await import(path.join(root, 'package.json'))).eslintConfig;

  const htmlPack = getHtmlPack(options, config);
  const stylePack = getStylePack(options, config);
  const workboxPack = getWorkboxPack(options, config);

  return {
    options,
    config,
    webpackConfig: merge(
      dev ? developmentConfig : productionConfig,
      {
        entry: [
          dev && require.resolve('react-dev-utils/webpackHotDevClient'),
          ...config.paths.entries,
        ].filter(Boolean),
        output: {
          path: config.paths.output,
          publicPath,
          filename: outputFilename,
          chunkFilename: outputChunkFilename,
        },
        optimization: {
          runtimeChunk: true,
          splitChunks: {
            chunks: 'all',
            name: false,
          },
        },
        resolve: {
          plugins: [
            new ModuleScopePlugin(config.paths.sources, [path.join(root, 'package.json')]),
            config.paths.tsconfig && new TsconfigPathsPlugin({ configFile: config.paths.tsconfig }),
          ].filter(Boolean),
          symlinks: false,
          modules: ['node_modules']
            .concat(path.resolve(path.join(__dirname, 'node_modules')))
            .concat(process.env.NODE_PATH.split(path.delimiter).filter(Boolean)),
          extensions: ['.web.ts', '.ts', '.web.tsx', '.tsx', '.web.js', '.js', '.json', '.web.jsx', '.jsx'],
          alias: {
            'react-native': 'react-native-web',
            ...tsconfigAliases,
            ...aliases,
          },
        },
        module: {
          strictExportPresence: true,
          rules: [
            { parser: { requireEnsure: false } },
            await hasEslintConfig() && {
              test: /\.(js|ts)x?$/,
              enforce: 'pre',
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
              enforce: 'pre',
              include: config.paths.sources[0],
            },
            {
              test: /\.mjs$/,
              include: /node_modules/,
              type: 'javascript/auto',
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
                // Source TS
                !!config.paths.tsconfig && {
                  test: /\.(ts|tsx)$/,
                  include: config.paths.sources,
                  use: [
                    {
                      loader: require.resolve('ts-loader'),
                      options: { transpileOnly: true },
                    },
                  ],
                },
                // Source JS
                {
                  test: /\.(js|jsx)$/,
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
                // Styles
                ...stylePack.rules,
                {
                  loader: require.resolve('file-loader'),
                  exclude: [/\.(js|jsx|json|html)$/],
                  options: {
                    name: outputAssetFilename,
                  },
                },
              ],
            },
          ].filter(Boolean),
        },
        plugins: [
          circularDependencies && new CircularDependencyPlugin({
            exclude: /node_modules/,
            failOnError: circularDependencies === 'error',
            allowAsyncCycles: false,
            cwd: process.cwd(),
          }),
          ...htmlPack.plugins,
          ...stylePack.plugins,
          ...workboxPack.plugins,
          new webpack.DefinePlugin(stringifiedEnvironment),
          dev && new webpack.HotModuleReplacementPlugin(),
          dev && new CaseSensitivePathsPlugin(),
          dev && new WatchMissingNodeModulesPlugin(path.resolve(root, 'node_modules')),
          new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
          !!config.paths.tsconfig && new ForkTsCheckerWebpackPlugin({
            async: false,
            watch: dev ? config.paths.sources : undefined,
            tsconfig: config.paths.tsconfig,
            tslint: config.paths.tslint,
          }),
          new ManifestPlugin({
            fileName: 'asset-manifest.json',
            publicPath,
          }),
        ].filter(Boolean),
        node: type !== 'node' && {
          dgram: 'empty',
          fs: 'empty',
          net: 'empty',
          tls: 'empty',
          child_process: 'empty',
        },
        performance: false,
      },
    ),
  };
};

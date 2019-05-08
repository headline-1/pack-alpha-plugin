import { Config } from '../config/config.types';
import { locate, use } from '../utils/buildDependencyManager.util';
import { Configuration } from 'webpack';
import { hasDependency } from '../utils/packageJson.util';

const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

export const getStylePack = async (config: Config): Promise<Configuration> => {
  const {
    options: {
      sourceMaps,
      outputCssFilename,
      outputCssChunkFilename,
    }
  } = config;

  if (!await hasDependency('node-sass')) {
    throw new Error('In order to process styles you need to install node-sass for project.');
  }
  await use('postcss-loader', '3.0.0');
  await use('sass-lint', '1.13.1');
  await use('sass-loader', '7.1.0');
  await use('css-loader', '2.1.1');
  const safePostCssParser = await use('postcss-safe-parser', '4.0.1');
  const OptimizeCSSAssetsPlugin = await use('optimize-css-assets-webpack-plugin', '5.0.1');
  const MiniCssExtractPlugin = await use('mini-css-extract-plugin', '0.6.0');
  const PostCSSFlexbugsFixesPlugin = await use('postcss-flexbugs-fixes', '4.1.0');
  const PostCSSPresetEnvPlugin = await use('postcss-preset-env', '6.6.0');
  const getCSSModuleLocalIdent = await use('react-dev-utils/getCSSModuleLocalIdent', '9.0.0');

  const getStyleLoaders = async (cssOptions: any, preProcessor?: string) => {
    const loaders = [
      MiniCssExtractPlugin.loader,
      {
        loader: await locate('css-loader'),
        options: cssOptions,
      },
      {
        // Options for PostCSS as we reference these options twice
        // Adds vendor prefixing based on your specified browser support in
        // package.json
        loader: await locate('postcss-loader'),
        options: {
          // Necessary for external CSS imports to work
          // https://github.com/facebook/create-react-app/issues/2677
          ident: 'postcss',
          plugins: () => [
            PostCSSFlexbugsFixesPlugin,
            PostCSSPresetEnvPlugin({
              autoprefixer: {
                flexbox: 'no-2009',
              },
              stage: 3,
            }),
          ],
          sourceMap: cssOptions.sourceMap,
        },
      },
    ];
    if (preProcessor) {
      loaders.push({
        loader: require.resolve(preProcessor),
        options: {
          sourceMap: cssOptions.sourceMaps,
        },
      });
    }
    return loaders;
  };

  return {
    optimization: {
      minimizer: [
        new OptimizeCSSAssetsPlugin({
          cssProcessorOptions: {
            parser: safePostCssParser,
            map: { inline: false, annotation: true },
          },
        }),
      ],
    },
    module: {
      rules: [
        {
          test: cssRegex,
          exclude: cssModuleRegex,
          loader: await getStyleLoaders({
            importLoaders: 1,
            sourceMap: sourceMaps,
          }),
        },
        {
          test: cssModuleRegex,
          loader: await getStyleLoaders({
            importLoaders: 1,
            sourceMap: sourceMaps,
            modules: true,
            getLocalIdent: getCSSModuleLocalIdent,
          }),
        },
        {
          test: sassRegex,
          exclude: sassModuleRegex,
          loader: await getStyleLoaders(
            {
              importLoaders: 2,
              sourceMap: sourceMaps,
            },
            await locate('sass-loader'),
          ),
        },
        {
          test: sassModuleRegex,
          loader: await getStyleLoaders(
            {
              importLoaders: 2,
              sourceMap: sourceMaps,
              modules: true,
              getLocalIdent: getCSSModuleLocalIdent,
            },
            await locate('sass-loader'),
          ),
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: outputCssFilename,
        chunkFilename: outputCssChunkFilename,
      }),
    ]
  };
};

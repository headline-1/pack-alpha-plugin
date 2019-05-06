import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import getCSSModuleLocalIdent from 'react-dev-utils/getCSSModuleLocalIdent';
import PostCSSFlexbugsFixesPlugin from 'postcss-flexbugs-fixes';
import PostCSSPresetEnvPlugin from 'postcss-preset-env';
import { Pack } from './pack.type';

const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

const getStyleLoaders = (cssOptions: any, preProcessor?: string) => {
  const loaders = [
    MiniCssExtractPlugin.loader,
    {
      loader: require.resolve('css-loader'),
      options: cssOptions,
    },
    {
      // Options for PostCSS as we reference these options twice
      // Adds vendor prefixing based on your specified browser support in
      // package.json
      loader: require.resolve('postcss-loader'),
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

export const getStylePack: Pack = ({
  sourceMaps,
  outputCssFilename,
  outputCssChunkFilename,
}) => ({
  rules: [
    {
      test: cssRegex,
      exclude: cssModuleRegex,
      loader: getStyleLoaders({
        importLoaders: 1,
        sourceMap: sourceMaps,
      }),
    },
    {
      test: cssModuleRegex,
      loader: getStyleLoaders({
        importLoaders: 1,
        sourceMap: sourceMaps,
        modules: true,
        getLocalIdent: getCSSModuleLocalIdent,
      }),
    },
    {
      test: sassRegex,
      exclude: sassModuleRegex,
      loader: getStyleLoaders(
        {
          importLoaders: 2,
          sourceMap: sourceMaps,
        },
        'sass-loader',
      ),
    },
    {
      test: sassModuleRegex,
      loader: getStyleLoaders(
        {
          importLoaders: 2,
          sourceMap: sourceMaps,
          modules: true,
          getLocalIdent: getCSSModuleLocalIdent,
        },
        'sass-loader',
      ),
    },
  ],
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: outputCssFilename,
      chunkFilename: outputCssChunkFilename,
    }),
  ]
});

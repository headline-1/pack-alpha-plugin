import { isTruthy } from '../utils/notNil.util';
import { Config } from '../config/config.types';
import { Configuration } from 'webpack';
import InlineChunkHtmlPlugin from 'react-dev-utils/InlineChunkHtmlPlugin';
import InterpolateHtmlPlugin from 'react-dev-utils/InterpolateHtmlPlugin';
import { use } from '../utils/buildDependencyManager.util';

export const getHtmlPack = async ({ options: { html, mode }, environment }: Config): Promise<Configuration> => {
  if (!html) {
    return {};
  }
  const dev = mode === 'development';

  const { default: HtmlWebpackPlugin } = await use('html-webpack-plugin', '4.0.0-beta.5');
  return {
    plugins: [
      new HtmlWebpackPlugin({
        inject: true,
        template: html !== true ? html : undefined,
        minify: !dev ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        } : undefined,
      }),
      !dev && new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime~.+[.]js/]),
      new InterpolateHtmlPlugin(HtmlWebpackPlugin, environment),
    ].filter(isTruthy),
  };
};

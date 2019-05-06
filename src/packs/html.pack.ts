import HtmlWebpackPlugin from 'html-webpack-plugin';
import InlineChunkHtmlPlugin from 'react-dev-utils/InlineChunkHtmlPlugin';
import InterpolateHtmlPlugin from 'react-dev-utils/InterpolateHtmlPlugin';
import { Pack } from './pack.type';
import { Plugin } from 'webpack';

export const getHtmlPack: Pack = ({
  html,
  mode,
}, {
  environment,
}) => {
  const dev = mode === 'development';
  return {
    rules: [],
    plugins: html
      ? [
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
      ].filter(Boolean) as Plugin[]
      : [],
  };
};

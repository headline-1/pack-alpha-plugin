'use strict';

import errorOverlayMiddleware from 'react-dev-utils/errorOverlayMiddleware';
import evalSourceMapMiddleware from 'react-dev-utils/evalSourceMapMiddleware';
import noopServiceWorkerMiddleware from 'react-dev-utils/noopServiceWorkerMiddleware';
import { ConfigResult } from './config.types';
import * as WebpackDevServer from 'webpack-dev-server';
import { ProxyConfigArray } from 'webpack-dev-server';

const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
const host = process.env.HOST || '0.0.0.0';

export const createWebpackDevServerConfiguration = (
  { options, config, webpackConfig }: ConfigResult,
  proxy: ProxyConfigArray | undefined,
  allowedHost: string | undefined,
): WebpackDevServer.Configuration => {
  return {
    disableHostCheck:
      !proxy || process.env.DANGEROUSLY_DISABLE_HOST_CHECK === 'true',
    compress: true,
    clientLogLevel: 'none',
    contentBase: options.staticPath,
    watchContentBase: true,
    hot: true,
    publicPath: webpackConfig.output!.publicPath,
    quiet: true,
    watchOptions: {
      ignored: config.ignore.length ? config.ignore : [
        /[\\/]node_modules[\\/]/
      ]
    },
    https: protocol === 'https',
    host,
    overlay: false,
    historyApiFallback: {
      disableDotRule: true,
    },
    public: allowedHost,
    proxy,
    before: (app, server) => {
      app.use(evalSourceMapMiddleware(server));
      app.use(errorOverlayMiddleware());
      app.use(noopServiceWorkerMiddleware());
    },
  };
};

/* eslint-disable */
import { isTruthy } from '../utils/notNil.util';
import { Config } from '../config/config.types';
import { use } from '../utils/buildDependencyManager.util';
import { Configuration } from 'webpack';

export const getWorkboxPack = async ({
  options: {
    publicPath,
    mode,
    serviceWorker,
  },
}: Config): Promise<Configuration> => {
  const dev = mode === 'development';

  const WorkboxWebpackPlugin = await use('workbox-webpack-plugin', '4.3.1');

  return {
    plugins: [
      !dev && serviceWorker && new WorkboxWebpackPlugin.GenerateSW({
        swDest: 'service-worker.js',
        importWorkboxFrom: 'local',
        precacheManifestFilename: 'precache-manifest.[manifestHash].js',
        // TODO: Consider adding catch handler for invalid routes (or rather routes that fail to respond for some reason)
        // https://developers.google.com/web/tools/workbox/guides/advanced-recipes#provide_a_fallback_response_to_a_route
        // importScripts: [],
        clientsClaim: true,
        exclude: [
          /\.(png|jpe?g|gif|svg|webp)$/i,
          /\.map$/,
          /^manifest.*\\.js(?:on)?$/,
          /asset-manifest\.json$/,
        ],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
                // keep cache for one day
                maxAgeSeconds: 86400,
                purgeOnQuotaError: true,
              },
            },
          },
        ],
        navigateFallback: `${publicPath}/index.html`.replace(/\/{2,}/g, '/'),
        navigateFallbackBlacklist: [
          new RegExp('/[^/]+\\.[^/]+$'),
        ],
      }),
    ].filter(isTruthy),
  };
};

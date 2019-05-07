/* eslint-disable */
import { Pack } from './pack.type';
import { isTruthy } from '../utils/notNil.util';

const WorkboxWebpackPlugin = require('workbox-webpack-plugin');

export const getWorkboxPack: Pack = ({
  publicPath,
  mode,
  serviceWorker,
}) => {
  const dev = mode === 'development';
  return {
    rules: [],
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

import * as path from 'path';
import { isTruthy } from '../utils/notNil.util';
import { accessFile } from '../utils/access.util';
import { locate, use } from '../utils/buildDependencyManager.util';
import { Config } from '../config/config.types';
import { Configuration } from 'webpack';

const getTsconfig = () => accessFile('tsconfig.json');
const getTslint = () => accessFile('tslint.json');

const useTypescriptPack = () => !!getTsconfig();

const aliasTsconfigPaths = (tsconfig: any) => Object
  .entries((tsconfig.compilerOptions.paths || {}) as Record<string, string[]>)
  .reduce((aliases, [key, [value]]) => {
    const slashIndex = key.indexOf('/');
    const exactMatch = key.indexOf('*') < 0 ? '$' : '';
    aliases[(slashIndex < 0 ? key : key.slice(0, slashIndex)) + exactMatch] = path.resolve(value);
    return aliases;
  }, {} as Record<string, string>);

export const getTypescriptPack = async (config: Config): Promise<Configuration> => {
  if (!await useTypescriptPack()) {
    return {};
  }
  const tsconfig = await getTsconfig();
  const tslint = await getTslint();

  await use('ts-loader', '5.4.4');
  const { default: TsconfigPathsPlugin } = await use('tsconfig-paths-webpack-plugin', '3.2.0');
  const { default: ForkTsCheckerWebpackPlugin } = await use('fork-ts-checker-webpack-plugin', '1.2.0');

  return {
    resolve: {
      plugins: [
        new TsconfigPathsPlugin({ configFile: tsconfig }),
      ].filter(isTruthy),
      alias: aliasTsconfigPaths(require(tsconfig)),
    },
    module: {
      rules: [
        {
          oneOf: [
            // Source TS
            {
              test: /\.(ts|tsx)$/,
              include: config.paths.sources,
              use: [
                {
                  loader: await locate('ts-loader'),
                  options: {
                    configFile: tsconfig,
                    transpileOnly: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        async: false,
        watch: config.options.mode === 'development' ? config.paths.sources : undefined,
        tsconfig,
        tslint,
      }),
    ]
  };
};

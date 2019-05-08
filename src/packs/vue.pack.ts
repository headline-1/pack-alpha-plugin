import { Config } from '../config/config.types';
import { locate, use } from '../utils/buildDependencyManager.util';
import { Configuration } from 'webpack';
import { getDependencyVersion } from '../utils/packageJson.util';

const getVueVersion = () => getDependencyVersion('vue');

const useVuePack = async () => {
  return !!(await getVueVersion());
};

export const getVuePack = async ({}: Config): Promise<Configuration> => {
  if (!await useVuePack()) {
    return {};
  }
  const vueVersion = (await getVueVersion())!;
  const VueLoaderPlugin = await use('vue-loader/lib/plugin', '15.7.0');
  await use('vue-style-loader', '4.1.2');
  const vueTemplateCompiler = await use('vue-template-compiler', vueVersion);

  return {
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: await locate('vue-loader'),
        },
        {
          test: /\.css$/,
          use: [
            await locate('vue-style-loader'),
          ],
        }
      ]
    },
    plugins: [
      new VueLoaderPlugin({
        compiler: vueTemplateCompiler,
      })
    ]
  };
};

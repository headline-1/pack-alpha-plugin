import { getHtmlPack } from './html.pack';
import { Config } from '../config/config.types';
import { getStylePack } from './style.pack';
import { getTypescriptPack } from './typescript.pack';
import { getVuePack } from './vue.pack';
import { getWorkboxPack } from './workbox.pack';

export const getPacks = async (config: Config) => ([
  await getHtmlPack(config),
  await getStylePack(config),
  await getTypescriptPack(config),
  await getVuePack(config),
  await getWorkboxPack(config),
]);

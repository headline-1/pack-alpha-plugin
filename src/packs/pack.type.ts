import { Config } from '../config/config.types';
import { Configuration } from 'webpack';

export type Pack<T = {}> = (config: Config) => Promise<Configuration>

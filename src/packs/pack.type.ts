import { Config, ConfigOptions } from '../config/config.types';
import { Plugin, RuleSetRule } from 'webpack';

export type Pack<T = {}> = (options: T & ConfigOptions, config: Config) => ({
  rules: RuleSetRule[];
  plugins: Plugin[];
});

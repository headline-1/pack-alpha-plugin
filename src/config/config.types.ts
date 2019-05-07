import { Configuration } from 'webpack';

export interface ConfigOptions {
  type: 'browser' | 'browserLibrary';
  root: string;
  entry: string | string[];
  mode: 'production' | 'development';
  staticPath?: string;
  outputPath?: string;
  outputFilename?: string;
  outputChunkFilename?: string;
  outputAssetFilename?: string;
  outputCssFilename?: string
  outputCssChunkFilename?: string;
  publicPath?: string;
  tslintPath?: string;
  tsconfigPath?: string;
  aliases?: Record<string, string>;
  sources?: string[];
  sourceMaps?: boolean;
  circularDependencies?: 'error' | 'warn' | 'disable';
  html?: boolean | string;
  env: Record<string, string>;
  ignore?: RegExp | RegExp[];
  stats?: boolean;
  serviceWorker?: boolean;
}

export interface Config {
  environment: Record<string, string>;
  ignore: RegExp[];
  paths: {
    output: string;
    entries: string[];
    sources: string[];
    tsconfig?: string;
    tslint?: string;
    packageJson?: string;
  }
}

export interface ConfigResult {
  options: ConfigOptions;
  config: Config;
  webpackConfig: Configuration;
}

import { exec, Logger, makeDir, readFile } from '@lpha/core';
import * as path from 'path';
import PromiseQueue from 'promise-queue';
import { accessFile } from './access.util';

interface PackageJson {
  name: string;
  version: string;
  description?: string;
}

const TAG = 'Build Dependency Manager';

const innerProjectLocation = path.join(process.cwd(), 'node_modules/.cache/pack-alpha-plugin/inner-dependencies');
const packageJsonLocation = path.join(innerProjectLocation, 'package.json');
const nodeModulesLocation = path.join(innerProjectLocation, 'node_modules');

const dependencyManagerQueue = new PromiseQueue(1, Infinity);

const useYarn = async () => !!(await accessFile('yarn.lock'));

const getPackageJsonFor = async (packageName: string): Promise<PackageJson | undefined> => {
  try {
    return JSON.parse(await readFile(path.join(nodeModulesLocation, packageName, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
};

const projectExists = async () => !!(await accessFile (packageJsonLocation));

const assureInnerProjectExists = async () => {
  if (await projectExists()) {
    return;
  }
  Logger.log(TAG, 'Creating inner project for build dependencies...');
  await makeDir(innerProjectLocation);
  const init = (await useYarn()) ? 'yarn init -y' : 'npm init -y';
  await exec(`cd '${innerProjectLocation}' && ${init}`, { silent: true });
};

const getInstallPackageName = (packageName: string) => {
  const installName = packageName.split('/');
  if (!installName[0].startsWith('@')) {
    return installName[0];
  }
  return `${installName[0]}/${installName[1]}`;
};

const assurePackageExists = async (packageName: string, version: string) => {
  await assureInnerProjectExists();
  const installPackageName = getInstallPackageName(packageName);
  const packageJson = await getPackageJsonFor(installPackageName);
  if (!packageJson) {
    Logger.log(TAG, `Installing required build dependency: ${installPackageName}@${version}...`);
    const add = (await useYarn())
      ? `yarn add ${installPackageName}@${version}`
      : `npm install ${installPackageName}@${version}`;
    await exec(`cd ${innerProjectLocation} && ${add}`, { silent: true });
    Logger.log(TAG, `Installed ${packageName}@${version}`);
  }
};

export const use = async (packageName: string, version: string): Promise<any> => {
  await dependencyManagerQueue.add(async () => {
    await assurePackageExists(packageName, version);
  });
  return await import(path.join(nodeModulesLocation, packageName));
};

export const locate = async (packageName: string): Promise<string> => {
  await dependencyManagerQueue.add(async () => {
    await assureInnerProjectExists();
  });
  return path.join(nodeModulesLocation, packageName);
};

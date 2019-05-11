import { Access, access, exec, Logger, makeDir, readFile } from '@lpha/core';
import * as path from 'path';
import PromiseQueue from 'promise-queue';
import { accessFile } from './access.util';

interface PackageJson {
  name: string;
  version: string;
  description?: string;
}

const TAG = 'Build Tools Manager';

const paths = {
  cache: '',
  innerProject: '',
  packageJson: '',
  nodeModules: '',
};

export const setCacheLocation = (location: string) => {
  paths.cache = path.isAbsolute(location) ? location : path.join(process.cwd(), location);
  paths.innerProject = path.join(paths.cache, 'inner-dependencies');
  paths.packageJson = path.join(paths.innerProject, 'package.json');
  paths.nodeModules = path.join(paths.innerProject, 'node_modules');
};

const dependencyManagerQueue = new PromiseQueue(1, Infinity);

const useYarn = async () => !!(await accessFile('yarn.lock'));

const getPackageJsonFor = async (packageName: string): Promise<PackageJson | undefined> => {
  try {
    return JSON.parse(await readFile(path.join(paths.nodeModules, packageName, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
};

const projectExists = () => access(paths.packageJson, Access.EXISTS);

let projectChecked = false;
const assureInnerProjectExists = async () => {
  if (projectChecked) {
    return;
  }
  if (await projectExists()) {
    projectChecked = true;
    return;
  }
  Logger.log(TAG, 'Creating inner project for build dependencies...');
  await makeDir(paths.innerProject);
  const init = (await useYarn()) ? 'yarn init -y' : 'npm init -y';
  await exec(`cd '${paths.innerProject}' && ${init}`, { silent: true });
  projectChecked = true;
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
    await exec(`cd ${paths.innerProject} && ${add}`, { silent: true });
    Logger.log(TAG, `Installed ${packageName}@${version}`);
  }
};

export const use = async (packageName: string, version: string): Promise<any> => {
  await dependencyManagerQueue.add(() => assurePackageExists(packageName, version));
  return await import(path.join(paths.nodeModules, packageName));
};

export const locate = async (packageName: string): Promise<string> => {
  await dependencyManagerQueue.add(() => assureInnerProjectExists());
  return path.join(paths.nodeModules, packageName);
};

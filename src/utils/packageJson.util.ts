import { accessFile } from './access.util';

export const getPackageJson = async (): Promise<any> => {
  const packageJsonFile = await accessFile('package.json');
  if (!packageJsonFile) {
    return undefined;
  }
  return require(packageJsonFile);
};

export const hasDependency = async (libraryName: string) => {
  return !!(await getDependencyVersion(libraryName));
};

export const getDependencyVersion = async (libraryName: string) => {
  const packageJson = await getPackageJson();
  const versions = Object.keys(packageJson)
    .filter(key => key.toLowerCase().includes('dependencies'))
    .map(key => packageJson[key])
    .reduce((versions, object) => {
      versions.push(...Object.entries(object)
        .filter(([key]) => key === libraryName)
        .map(([, value]) => value)
      );
      return versions;
    }, []);
  return versions[0];
};

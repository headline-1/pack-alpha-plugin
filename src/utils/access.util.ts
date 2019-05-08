import { Access, access, readDir } from '@lpha/core';
import * as path from 'path';

const tryToReadDir = async (path: string): Promise<string[]> => {
  try {
    return await readDir(path);
  } catch {
    return [];
  }
};

export const accessFile = async (name: string | RegExp) => {
  const cwd = process.cwd();
  if (typeof name === 'string') {
    const filePath = path.join(cwd, name);
    if (await access(path.join(cwd, name), Access.EXISTS)) {
      return filePath;
    }
  }
  return (await tryToReadDir(cwd))
    .filter(file => !!file.match(name))
    .map(f => path.join(cwd, f))
    [0];
};

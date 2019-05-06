import { Access, access, readDir } from '@lpha/core';
import * as path from 'path';

export const accessFile = async (name: string | RegExp) => {
  const cwd = process.cwd();
  if(typeof name ==='string'){
    const filePath = path.join(cwd, name);
    await access(path.join(cwd, name), Access.EXISTS);
    return filePath;
  }
  return (await readDir(cwd))
    .filter(file => !!file.match(name))
    .map(f => path.join(cwd, f))
    [0];
};

export const fromEntries = (map: any[]): any =>
  Array.from(map).reduce((acc, [ key, val ]) => Object.assign(acc, { [key]: val }), {} as any);
